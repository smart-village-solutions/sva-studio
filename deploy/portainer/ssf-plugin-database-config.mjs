export const readDatabasePassword = ({
  connectionString,
  expectedDatabase,
  expectedUser,
  name,
}) => {
  const value = connectionString?.trim();
  if (!value) throw new Error(`${name}_missing`);
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name}_invalid`);
  }
  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new Error(`${name}_invalid`);
  }
  if (decodeURIComponent(parsed.username) !== expectedUser) {
    throw new Error(`${name}_user_mismatch`);
  }
  if (decodeURIComponent(parsed.pathname.slice(1)) !== expectedDatabase) {
    throw new Error(`${name}_database_mismatch`);
  }
  const password = decodeURIComponent(parsed.password);
  if (!password) throw new Error(`${name}_password_missing`);
  return password;
};
