const ERRORS = {
    USER_NOT_FOUND: {
        key: "USER_NOT_FOUND",
        message: "User not found"
    },

    INVALID_USER_DATA: {
        key: "INVALID_USER_DATA",
        message: "firstName, lastName and email are required"
    },

    RANDOM_USER_API_ERROR: {
        key: "RANDOM_USER_API_ERROR",
        message: "Could not retrieve users from Random User API"
    },

    INTERNAL_SERVER_ERROR: {
        key: "INTERNAL_SERVER_ERROR",
        message: "Unexpected server error"
    }
};

module.exports = ERRORS;