const { PublicKey } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const axios = require('axios');
const { Metadata } = require('@metaplex-foundation/mpl-token-metadata');

async function getTokensByOwner(owner, conn) {
	const tokens = await conn.getParsedTokenAccountsByOwner(owner, {
		programId: TOKEN_PROGRAM_ID,
	});

  // initial filter - only tokens with 0 decimals & of which 1 is present in the wallet
	return tokens.value.filter((t) => {
		const amount = t.account.data.parsed.info.tokenAmount;
		return amount.decimals === 0 && amount.uiAmount === 1;
	}).map((t) => {
		return { pubkey: t.pubkey, mint: t.account.data.parsed.info.mint };
	});
}

async function getNFTMetadata(mint, conn, pubkey) {
	try {
		const metadataPDA = await Metadata.getPDA(mint);
		const onchainMetadata = (await Metadata.load(conn, metadataPDA)).data;
		const externalMetadata = (await axios.get(onchainMetadata.data.uri)).data;
		return {
			pubkey: pubkey ? new PublicKey(pubkey) : undefined,
			mint: new PublicKey(mint),
			onchainMetadata,
			externalMetadata,
		};
	} catch (e) {
		console.log(`failed to pull metadata for token ${mint}`);
	}
}

async function getNFTMetadataForMany(tokens, conn) {
  const promises = [];
  tokens.forEach((t) => promises.push(getNFTMetadata(t.mint, conn, t.pubkey)));
  const nfts = (await Promise.all(promises)).filter((n) => !!n);
  console.log(`found ${nfts.length} metadatas`);

  return nfts;
}

async function getNFTsByOwner(owner, conn) {
  const tokens = await getTokensByOwner(owner, conn);
  console.log(`found ${tokens.length} tokens`);

  return await getNFTMetadataForMany(tokens, conn);
}

module.exports = {getNFTsByOwner, getNFTMetadataForMany, getNFTMetadata};
