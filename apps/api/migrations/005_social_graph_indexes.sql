CREATE UNIQUE INDEX IF NOT EXISTS aist_scenario_likes_user_scenario_idx
  ON aist_records ((data->>'scenarioId'), (data->>'userId'))
  WHERE collection = 'scenarioLikes';

CREATE UNIQUE INDEX IF NOT EXISTS aist_user_follows_pair_idx
  ON aist_records ((data->>'followerUserId'), (data->>'followedUserId'))
  WHERE collection = 'userFollows';

CREATE UNIQUE INDEX IF NOT EXISTS aist_friendships_pair_idx
  ON aist_records (
    (LEAST(data->>'requesterUserId', data->>'addresseeUserId')),
    (GREATEST(data->>'requesterUserId', data->>'addresseeUserId'))
  )
  WHERE collection = 'friendships';
