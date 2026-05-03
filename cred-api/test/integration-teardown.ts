export default async () => {
  await global.__PG_CONTAINER__.stop();
};
