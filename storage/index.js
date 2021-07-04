const multer = require("multer");
const fs = require("fs");
const Tesseract = require("tesseract.js");

const storage = (userId) =>
	multer.diskStorage({
		destination: function (req, file, cb) {
			const dir = `./storage/uploads/${userId}`;
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir);
			}
			cb(null, dir);
		},
		filename: function (req, file, cb) {
			cb(null, Date.now() + file.originalname);
		},
	});

const fileFilter = (req, file, cb) => {
	// reject a file
	if (file.mimetype === "image/jpeg" || file.mimetype === "image/png") {
		cb(null, true);
	} else {
		cb(null, false);
	}
};

const upload = (userId) =>
	multer({
		storage: storage(userId),
		limits: {
			fileSize: 1024 * 1024 * 5,
		},
		fileFilter: fileFilter,
	});

const getTextFromImage = async (receiptPath) => {
	try {
		const receipt = {};
		const processed = await Tesseract.recognize(`./${receiptPath}`, "eng");

		const lines = processed.data.text.split("\n");
		lines.forEach((line) => {
			if (line.includes("C.I.F")) {
				receipt.cif = line.match(/R[0-9]+/)[0];
			} else if (line.includes("NUMAR BON")) {
				if (line.match(/[0-9]+-[0-9]+/)) {
					receipt.receiptNbr = line.match(/[0-9]+-[0-9]+/)[0];
				} else {
					receipt.receiptNbr = line.match(/[0-9]+/)[0];
				}
			} else if (line.match(/(?:[01]\d|2[0-3]):(?:[0-5]\d):(?:[0-5]\d)/)) {
				receipt.time = line.match(/(?:[01]\d|2[0-3]):(?:[0-5]\d)/)[0];
				receipt.date = line.match(
					/^(0?[1-9]|[12][0-9]|3[01])[\/\-\.](0?[1-9]|1[012])[\/\-\.]\d{4}/
				)[0];
			}
		});

		return receipt;
	} catch (e) {
		console.error(e);
	}
};

module.exports = {
	upload,
	getTextFromImage,
};
