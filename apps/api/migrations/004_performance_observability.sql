CREATE INDEX IF NOT EXISTS aist_performance_created_idx
  ON aist_records ((data->>'createdAt') DESC)
  WHERE collection = 'performanceTraces';

CREATE INDEX IF NOT EXISTS aist_performance_user_phase_created_idx
  ON aist_records ((data->>'userId'), (data->>'source'), (data->>'phase'), (data->>'createdAt') DESC)
  WHERE collection = 'performanceTraces';
