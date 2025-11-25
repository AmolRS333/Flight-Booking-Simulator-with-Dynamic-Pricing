const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';

const randomFrom = (source, length) => {
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += source.charAt(Math.floor(Math.random() * source.length));
  }
  return result;
};

const generatePNR = () => {
  const prefix = randomFrom(ALPHABET, 3);
  const suffix = randomFrom(DIGITS, 3);
  return `${prefix}${suffix}`;
};

module.exports = generatePNR;


