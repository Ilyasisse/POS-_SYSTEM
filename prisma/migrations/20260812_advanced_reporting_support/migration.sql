CREATE INDEX "StockEvent_occurredAt_type_idx" ON "StockEvent"("occurredAt", "type");
CREATE INDEX "Order_closedAt_customerId_idx" ON "Order"("closedAt", "customerId");
CREATE INDEX "KitchenTransitionEvent_occurredAt_station_idx" ON "KitchenTransitionEvent"("occurredAt", "station");
