CREATE INDEX sub_status_idx ON subscriptions(
    sub_status
);
CREATE INDEX subscription_time_idx ON subscriptions(
    start_from, ends_at
);
CREATE INDEX events_type_idx ON user_events(
    event_type
);
CREATE INDEX events_quantity_idx ON user_events(
    quantity
);
CREATE INDEX stripe_type_idx on stripe_events(
    event_type
);