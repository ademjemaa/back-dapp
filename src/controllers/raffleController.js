/* Models */
const Raffle = require('../models/Raffle');
const User = require('../models/User');
const schema = require('../schemas/raffleSchema');

/* Controllers */
const Wallet = require('../controllers/walletController');

/* Helpers */
const { HttpError } = require('../../system/helpers/HttpError');
const { HttpResponse } = require('../../system/helpers/HttpResponse');

/* ̉̉̉̉Solana */
const { PublicKey, Transaction, sendAndConfirmTransaction } = require('@solana/web3.js');
const { getOrCreateAssociatedTokenAccount, createTransferInstruction } = require('@solana/spl-token');
const { getNFTsByOwner, getNFTMetadataForMany } = require('../common/web3/NFTget');

/* Common */
const { initGemBank } = require('../common/gem-bank');
const { timeout, retry } = require('../common/util');

/* Utils */
const autoBind = require('auto-bind');

/* Config */
const config = require('../../config.json');
const { default: mongoose } = require('mongoose');
const { findVaultPDA } = require('@gemworks/gem-farm-ts');

class RaffleController {
	constructor() {
		this.model = new Raffle().getInstance();
		this.userModel = new User().getInstance();
		this.wallet = new Wallet();

		autoBind(this);

		this.relaunch();
	}

	async relaunch() {
		try {
			const stakings = await this.model.find({status: {$in: [0, 1]}});
			if (!stakings || !stakings.length) return;

			await Promise.all(stakings.map(async staking => {
				const walletNFTs  = await getNFTsByOwner(this.wallet.publicKey, this.wallet.connection);

				const nftMetadata = walletNFTs.find(nft => (nft.pubkey.toBase58() == staking.nft));
				
				if (!nftMetadata || !nftMetadata.mint) return;
				return this.init(staking.registerTime, staking.endTime, staking.bank, nftMetadata.mint);
			}));

			console.log('relaunch: success to init raffles.');

		} catch(err) {
			console.error('relaunch:', err);
		}

		try {
			const stakings = await this.model.find({status: 2});
			if (!stakings || !stakings.length) return;
			
			const gemBank = await retry(
				initGemBank,
				[this.wallet.connection, this.wallet.wallet],
				100,
				200
			);

			await Promise.all(stakings.map(async staking => {
				return this.setVaultsLockWallet(gemBank, staking.bank, false);
			}));
		} catch(err) {
			console.log('relaunch:', err);
		}
	}

	async transfer(pubkey, nft, bank) {
		const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
			this.wallet.connection,
			this.wallet.wallet.payer,
			new PublicKey(nft),
			this.wallet.publicKey
		);
		
		const associatedDestinationTokenAddr = await getOrCreateAssociatedTokenAccount(
			this.wallet.connection,
			this.wallet.wallet.payer,
			new PublicKey(nft),
			new PublicKey(pubkey)
		);

		const transaction = new Transaction().add(
			createTransferInstruction(
				fromTokenAccount.address,
				associatedDestinationTokenAddr.address,
				this.wallet.publicKey,
				1
			)
		);	
			
		const signature = await sendAndConfirmTransaction(
			this.wallet.connection,
			transaction,
			[this.wallet.kp],
		);	

		await this.model.updateOne(
			{ bank: bank },
			{ winner: pubkey }
		)

		console.log('transfer(' + signature + '):', 'bank(' + bank + ')', 'nft(' + nft + ')', 'pubkey(' + pubkey + ')');
		return signature;
	}
	
	getRandomUser(users, bankTickets) {
		if (!users || !users.length) return;

		users = users.filter(user => user !== undefined);

		const rand = Math.floor(Math.random() * bankTickets);

		let tickets = 0;
		for (var user of users) {
			tickets += user.tickets;
				
			if (tickets >= rand)
				break;
		}
		return user.owner;
	}

	async parseUsersTickets(gemBank, bank, vaults) {
		const userDocuments = await retry(
			this.userModel.find.bind(this.userModel),
			[{ bank: bank }],
			100,
			200
		);

		const whitelistedVaults = userDocuments.map(e => e.vault);

		let bankTickets = 0;
		const users = await Promise.all(vaults.map( async vault => {
			const vaultPubkey = vault.publicKey;
			if (!vaultPubkey) return;

			const vaultAddress = vaultPubkey.toBase58();
			const owner = vault.account.owner.toBase58();
			
			if (!vaultAddress || !owner) return;
			if (!whitelistedVaults.includes(vaultAddress)) return;
			
			try {
				const foundGDRs = await gemBank.fetchAllGdrPDAs(vaultPubkey);
				if (!foundGDRs || !foundGDRs.length) return;

				const mints = foundGDRs.map((gdr) => { return { mint: gdr.account.gemMint } });

				const vaultNFTs = (await getNFTMetadataForMany(mints, this.wallet.connection))
					.filter(e => e.externalMetadata.symbol == 'ATLBC');
				
				if (!vaultNFTs || !vaultNFTs.length) return;
				
				let tickets = 0;
				vaultNFTs.forEach(nft => {
					const ticket = config.tickets.find(ticket =>
						ticket.name === (nft.externalMetadata?.attributes[0]?.value)
					);

					if (ticket)
						tickets += ticket.amount;
				})
				bankTickets += tickets;

				return { owner: owner, tickets: tickets }

			} catch (err) {
				console.error(err);
				return;
			}
		}))

		return { users, bankTickets };
	}

	async sendPriceToRandomUser(gemBank, bank, vaults, nft) {
		const { users, bankTickets } = await this.parseUsersTickets(gemBank, bank, vaults);
	 	const userPubkey = this.getRandomUser(users, bankTickets);

		try {
			await retry(
				this.transfer.bind(this),
				[userPubkey, nft, bank],
				100,
				200
			);
		} catch(err) {
			console.error('transfer:', 'bank(' + bank + ')', 'nft(' + nft + ')', 'pubkey(' + userPubkey + ')', 'failed.');
		}
	}

	async setVaultsLockWallet(gemBank, bank, isLocked) {
		try {
			/* Fectch all vaults of the bank */
			const bankPubkey = new PublicKey(bank);
			const vaults = await retry(
				gemBank.fetchAllVaultPDAs.bind(gemBank),
				[bankPubkey],
				100,
				200
			);
			if (!vaults.length) return;
			
			let count = 0;
			await Promise.all(vaults.map( async vault => {
				if (vault.account.locked == isLocked) return vault;
				console.log(vault.account.locked);

				console.log('Vault', count, ':', vault?.publicKey?.toBase58(), 'is', (isLocked ? 'locked.' : 'unlocked.') );
				
				count++;
				return retry(
					gemBank.setVaultLockWallet.bind(gemBank),
					[bankPubkey, vault.publicKey, isLocked],
					100,
					200
				);
			}));

			return vaults;
		} catch(err) {
			console.error(err);
		}

		console.log('Vaults locking: all vaults are locked')
	};

	async init(registerTime, endTime, bank, nft) {
		const currentTime = Date.now();
		
		/* Init smart contract */
		const gemBank = await retry(
			initGemBank,
			[this.wallet.connection, this.wallet.wallet],
			100,
			200
		);

		timeout(async () => {
			await this.model.updateOne({ bank: bank }, { status: 1 });
			this.setVaultsLockWallet(gemBank, bank, true);
		}, (registerTime - currentTime) )

		timeout(async () => {
			const vaults = await this.setVaultsLockWallet(gemBank, bank, false);
			await this.sendPriceToRandomUser(gemBank, bank, vaults, nft);
			await this.model.updateOne({ bank: bank }, { status: 2 });
		}, (endTime - currentTime) )
	}

	async isAdmin(req, res) {
		const { id } = req.params;
		
		if (!id) {
			const response = new HttpError({ name: "UnauthorizedError", errors: schema.errors });
			return res.status(response.statusCode).json(response);
		}

		if (!config.whitelisted_users.includes(id)) {
			const response = new HttpError({ name: "UnauthorizedError", errors: schema.errors });
			return res.status(response.statusCode).json(response);
		}

		const response = new HttpResponse();
		return res.status(response.statusCode).json(response);
	}

	async allowToRegister(req, res) {
		const { id } = req.params;

		if (!id) {
			const response = new HttpError({ name: "UnauthorizedError", errors: schema.errors });
			return res.status(response.statusCode).json(response);
		}

		try {
			const bank = await this.model.findOne({ bank: id })
			
			if (!bank || bank.status > 0) {
				const response = new HttpError({ name: "UnauthorizedError", errors: schema.errors });
				return res.status(response.statusCode).json(response);
			}

			return res.status(200).json('message: you can register.');
		} catch (err) {
			const response = new HttpError({ name: "UnauthorizedError", errors: schema.errors });
			return res.status(response.statusCode).json(response);
		}
	}

	async create(req, res) {
		if (!schema(req.body)) {
			const response = new HttpError({ name: "ValidationError", errors: schema.errors });
			return res.status(response.statusCode).json(response);
		}
		if (!config.whitelisted_users.includes(req.body.pubkey)) {
			const response = new HttpError({ name: "ValidationError", errors: 'You are not an administrator' });
			return res.status(response.statusCode).json(response);
		}

		try {
			const { bank, nft, registerTime, endTime } = req.body;

			const doc = await this.model.findOne({ nft: nft });
			if (doc)
				throw Error('The nft is already register for a raffle.');
			
			const walletNFTs  = await getNFTsByOwner(this.wallet.publicKey, this.wallet.connection);
			const nftMetadata = walletNFTs.find(e => e.pubkey.toBase58() === nft);
			if (!nftMetadata)
				throw Error('Impossible to find the nft in the wallet');
		
			const item = await this.model.create({
				bank: bank,
				nft: nft,
				image: nftMetadata.externalMetadata?.image || "",
				name: nftMetadata.externalMetadata?.name || "",
				registerTime: registerTime,
				endTime: endTime,
				status: 0
			});

			this.init(registerTime, endTime, bank, nftMetadata.mint);
			
			const response = new HttpResponse(item);
			return res.status(response.statusCode).json(response);
		} catch(err) {
			const response = new HttpError({ name: "ValidationError", errors: err.message });
			return res.status(response.statusCode).json(response);

		}
	}

	async get(req, res) {
		const { id } = req.params;

		try {
			const item = await this.model.findOne({_id: id});
	
			const response = new HttpResponse(item);
			return res.status(response.statusCode).json(response);
		}
		catch(err) {
			const response = new HttpError(err);
			return res.status(response.statusCode).json(response);
		}
	}

	async getAll(req, res) {
		try {
			const items = await this.model.find({});
			const total = await this.model.countDocuments(req.query);
	
			const response = new HttpResponse(items, { 'totalCount': total });
			return res.status(response.statusCode).json(response);
		}
		catch(err) {
			const res = new HttpError(err);
			return res.status(res.statusCode).json(res);
		}
	}

	async getAllWithGemCount(req, res) {
		const { user } = req.params;

		try {
			let items = await this.model.find({});
			const total = await this.model.countDocuments(req.query);

			try {
				const gemBank = await retry(
					initGemBank,
					[this.wallet.connection, this.wallet.wallet],
					100,
					200
				);
				if (items && items.length > 0) {
					items = await Promise.all(items.map(async item => {
						const pubkey = new PublicKey(item.bank);
						const userPubkey = new PublicKey(user);
						const [vaultAddr] = await findVaultPDA(pubkey, userPubkey);
						
						try {
							const acc = await gemBank.fetchVaultAcc(vaultAddr);
							if (acc?.gemCount?.words[0] > 0) {
								return {
									...item._doc,
									gemCount: acc?.gemCount?.words[0]
								}
							}
						} catch (err) {
							console.log(err);
						}
						return item;
					}));
				}
			} catch(err) {}
			
			const response = new HttpResponse(items, { 'totalCount': total });
			return res.status(response.statusCode).json(response);
		}
		catch(err) {
			const res = new HttpError(err.message);
			return res.status(res.statusCode).json(res);
		}
	}
}

module.exports = new RaffleController()