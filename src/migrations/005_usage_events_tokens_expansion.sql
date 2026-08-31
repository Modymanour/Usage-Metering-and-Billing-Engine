ALTER TABLE user_events
ADD input_tokens INT CHECK(input_tokens >= 0);

ALTER TABLE user_events
ADD cached_input_tokens INT CHECK(cached_input_tokens >= 0);

ALTER TABLE user_events
ADD output_tokens INT CHECK(output_tokens >= 0);

ALTER TABLE user_events
ADD reasoning_tokens INT CHECK(reasoning_tokens >= 0);