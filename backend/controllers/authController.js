const asyncHandler = require('../utils/asyncHandler');
const { signToken } = require('../utils/jwt');

const mockLogin = asyncHandler(async (req, res) => {
  const { user_id, name = 'Guest', role = 'user' } = req.body;

  if (!user_id) {
    return res.status(400).json({ message: 'user_id is required' });
  }

  const token = signToken({ id: user_id, name, role });

  return res.json({
    token,
    user: {
      id: user_id,
      name,
      role,
    },
  });
});

module.exports = {
  mockLogin,
};


