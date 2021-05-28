const multer = require("multer");
const fs = require("fs");

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

module.exports = {
	upload,
};
