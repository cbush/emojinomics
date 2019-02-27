exports = function({
  name, // Function name
  approxIntervalMinutes = 1, // approx. minutes before callback
  args,
}) {
  const client = context.services.get('mongodb-atlas');
  const db = client.db('emojinomics');
  const collection = db.collection('ttl');

  const document = {
    name,
    created: new Date(new Date().getTime() + (approxIntervalMinutes - 1) * 60 * 1000),
  };

  return collection.insertOne(document)
    .then(() => context.functions.execute(name, args));
};
