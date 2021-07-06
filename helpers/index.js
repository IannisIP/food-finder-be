const getReviewsByPlaceId = async (pool, placeId) => {
	const result = await pool.query("SELECT * from reviews WHERE placeId = ?", [
		placeId,
	]);
	return result[0];
};

const getReviewsByUserId = async (pool, userId) => {
	const result = await pool.query("SELECT * from reviews where userId = ?", [
		userId,
	]);
	return result[0];
};

const getReviewByReviewId = async (pool, reviewId) => {
	const result = await pool.query("SELECT * from reviews where id = ?", [
		reviewId,
	]);
	return result[0];
};

const removeReportById = async (pool, id) => {
	const result = await pool.query("DELETE from reportedreviews where id = ?", [
		id,
	]);
	return result[0];
};

const removeReviewById = async (pool, id) => {
	const result = await pool.query("DELETE from reviews where id = ?", [id]);
	return result[0];
};

const getPendingReviewsByUserId = async (pool, userId) => {
	const result = await pool.query(
		"SELECT * from pendingreviews where userId = ?",
		[userId]
	);
	return result[0];
};

const getReviewsByReceiptParams = async (pool, receiptParams) => {
	const result = await pool.query(
		"SELECT * from reviews where receiptParams = ?",
		[receiptParams]
	);
	return result[0];
};

const getAllPendingReviews = async (pool) => {
	const result = await pool.query("SELECT * from pendingreviews");
	return result[0];
};

const getPendingReviewById = async (pool, pendingReviewId) => {
	const result = await pool.query("select * from pendingreviews WHERE id=?", [
		pendingReviewId,
	]);
	return result[0];
};

const getAllUsers = async (pool) => {
	const result = await pool.query("SELECT * from users");
	return result[0];
};

const getUserById = async (pool, userId) => {
	const result = await pool.query("SELECT * from users where id = ?", [userId]);
	return result[0];
};

const addUser = async (
	pool,
	{ name, email, password, firstName, lastName }
) => {
	const result = await pool.query("INSERT INTO users SET ?", {
		email,
		password,
		first_name: firstName,
		last_name: lastName,
	});
	return result;
};

const getReportedReviews = async (pool) => {
	const result = await pool.query("SELECT * from reportedreviews");
	return result[0];
};

const getBlockedUsers = async (pool) => {
	const result = await pool.query("SELECT * from blacklist");
	return result[0];
};

const getBlockedUserById = async (pool, userId) => {
	const result = await pool.query("SELECT * from blacklist where userId = ?", [
		userId,
	]);
	return result[0];
};

module.exports = {
	addUser,
	getUserById,
	getAllUsers,
	getPendingReviewById,
	getAllPendingReviews,
	getReviewsByPlaceId,
	getPendingReviewsByUserId,
	getReviewsByUserId,
	getReviewsByReceiptParams,
	getReportedReviews,
	getReviewByReviewId,
	removeReviewById,
	removeReportById,
	getBlockedUsers,
	getBlockedUserById,
};
