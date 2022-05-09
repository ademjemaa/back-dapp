function timeout(fn, delay) {
	var maxDelay = Math.pow(2,31)-1;

	if (delay > maxDelay) {
		var args = arguments;
		args[1] -= maxDelay;

		return setTimeout(function () {
			setTimeout_.apply(undefined, args);
		}, maxDelay);
	}

	return setTimeout.apply(undefined, arguments);
}

const delay = (ms) => new Promise(res => setTimeout(res, ms));

const retry = async(fn, args, n, ms) => {
	let lastError;

	for (let i = 0; i < n; i++) {
		try {
			return await fn(...args);
		} catch(err) {
			lastError = err;
			await delay(ms);
		}
	}
	throw lastError;
}

module.exports = { retry, timeout }