ALTER TABLE user_events
ADD input_tokens INT;

ALTER TABLE user_events
ADD cached_input_tokens INT;

ALTER TABLE user_events
ADD output_tokens INT;

ALTER TABLE user_events
ADD reasoning_tokens INT;

ALTER TABLE user_events
ADD CONSTRAINT chk_event_type_and_data CHECK (
    event_type = 'api_call'
    AND quantity IS NOT NULL
    AND input_tokens IS NULL
    AND cached_input_tokens IS NULL
    AND output_tokens IS NULL
    AND reasoning_tokens IS NULL

    OR

    event_type = 'api_token'
    AND quantity IS NULL
    AND input_tokens IS NOT NULL
    AND cached_input_tokens IS NOT NULL
    AND output_tokens IS NOT NULL
    AND reasoning_tokens IS NOT NULL
);