export const persistUploadFile = async ({ command, absDir, absPath, buffer }) => {
  await command.mkdirRecursive(absDir);
  await command.writeFileBuffer(absPath, buffer);
};
