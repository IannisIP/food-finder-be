const AFINN = require("./afinn.json");

const getWords = (text) => {
	return text.toLowerCase().split(" ");
};

const getScore = (word) => {
	return AFINN[word] || 0;
};

const removeRestrictedCharacters = (word) => {
	return word.replace(/[^\w]/g, "");
};

const sum = (accumultor, currentValue) => {
	return accumultor + currentValue;
};

const analyseText = (text) => {
	return getWords(text)
		.map(removeRestrictedCharacters)
		.map(getScore)
		.reduce(sum);
};

//folosire translate pt unicitate limba

module.exports = { analyseText };
