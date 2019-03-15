function Reactor(user_id) {
  this.user_id = user_id;
  this.emoji_given_counts = {};
  this.reactee_counts = {};
}

function Reactee(user_id) {
  this.user_id = user_id;
  this.emoji_received_counts = {};
  this.reactor_counts = {};
}

function count_and_sort_entries(counts_by_key, key_name) {
  let total = 0;
  const entries = Object.entries(counts_by_key)
    .map((entry) => {
      total += entry[1];
      const object = {
        count: entry[1],
      };
      object[key_name] = entry[0];
      return object;
    });
  entries.sort((a, b) => b.count - a.count); // descending order
  return {
    total,
    entries,
  };
}

function Profile(user_id, reactor, reactee) {
  this.user_id = user_id;
  this.total_given = 0;
  this.top_given = [];
  this.top_crushes = [];
  this.total_received = 0;
  this.top_received = [];
  this.top_fans = [];

  const limit = 10;

  if (reactor !== undefined) {
    let result = count_and_sort_entries(reactor.emoji_given_counts, 'emoji');
    this.total_given = result.total;
    this.top_given = result.entries.slice(0, limit);
    result = count_and_sort_entries(reactor.reactee_counts, 'user_id');
    this.top_crushes = result.entries.slice(0, limit);
  }

  if (reactee !== undefined) {
    let result = count_and_sort_entries(reactee.emoji_received_counts, 'emoji');
    this.total_received = result.total;
    this.top_received = result.entries.slice(0, limit);
    result = count_and_sort_entries(reactee.reactor_counts, 'user_id');
    this.top_fans = result.entries.slice(0, limit);
  }
}

function add_count(object, key, count) {
  if (object[key] === undefined) {
    object[key] = 0;
  }
  object[key] += count;
}

// Get information about given & received reacts.
exports = async function({team_id, users}) {
  context.functions.execute('polyfills');

  const client = context.services.get('mongodb-atlas');
  const db = client.db('emojinomics');
  const collection = db.collection('reactions');
  const pipeline = [];

  pipeline.push({
    $match: {team_id},
  });

  const $group = {
    _id: {user_id: '$user', emoji: '$emoji', item_user_id: '$item_user'},
    count: {$sum: '$type'},
  };

  const $project = {
    _id: 0,
    user_id: '$_id.user_id',
    emoji: '$_id.emoji',
    item_user_id: '$_id.item_user_id',
    count: 1,
  };

  pipeline.push({$group});
  pipeline.push({$project});

  const entries = await collection
    .aggregate(pipeline)
    .toArray();

  const reactors = {};
  const reactees = {};
  const ids = {};
  entries.forEach((entry) => {
    const {
      user_id, emoji, item_user_id, count,
    } = entry;
    ids[user_id] = true;
    if (count === 0) {
      return;
    }
    if (reactors[user_id] === undefined) {
      reactors[user_id] = new Reactor(user_id);
    }
    const reactor = reactors[user_id];
    const {emoji_given_counts, reactee_counts} = reactor;
    add_count(emoji_given_counts, emoji, count);

    if (item_user_id === undefined) {
      return;
    }
    ids[item_user_id] = true;

    add_count(reactee_counts, item_user_id, count);

    if (reactees[item_user_id] === undefined) {
      reactees[item_user_id] = new Reactee(item_user_id);
    }
    const reactee = reactees[item_user_id];
    const {emoji_received_counts, reactor_counts} = reactee;
    add_count(emoji_received_counts, emoji, count);
    add_count(reactor_counts, user_id, count);
  });

  if (users === undefined) {
    users = Object.keys(ids);
  }
  const profiles_by_id = {};
  users.forEach((id) => {
    if (ids[id] === undefined) {
      return;
    }
    profiles_by_id[id] = new Profile(id, reactors[id], reactees[id]);
  });

  return profiles_by_id;
};
