exports = function({token}) {
  const slack = context.services.get('Slack');
  return slack.get({
    url: `https://slack.com/api/users.list?token=${token}`,
  }).then((response) => new Promise((resolve, reject) => {
    const body = EJSON.parse(response.body.text());
    const usersById = {};
    body.members.map((member) => {
      usersById[member.id] = member;
    });
    return resolve(usersById);
  }));
};
