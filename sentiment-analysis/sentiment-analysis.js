const AFINN = require("./afinn.json");

const getWords = (text) => {
	console.log(text);
	return text.toLowerCase().split(" ");
};

const getScore = (word) => {
	return AFINN[word] || 0;
};

const removeRestrictedCharacters = (word) => {
	console.log(word);
	return word.replace(/[^\w]/g, "");
};

const sum = (accumultor, currentValue) => {
	console.log(accumultor);
	return accumultor + currentValue;
};

const analyseText = (text) => {
	return getWords(text)
		.map(removeRestrictedCharacters)
		.map(getScore)
		.reduce(sum);
};

module.exports = { analyseText };
