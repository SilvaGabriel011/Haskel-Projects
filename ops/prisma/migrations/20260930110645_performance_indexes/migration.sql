-- CreateIndex
CREATE INDEX "Customer_phone_idx" ON "Customer"("phone");

-- CreateIndex
CREATE INDEX "Order_customerId_idx" ON "Order"("customerId");

-- CreateIndex
CREATE INDEX "ScheduleEvent_orderId_startAt_idx" ON "ScheduleEvent"("orderId", "startAt");

-- CreateIndex
CREATE INDEX "StockMovement_offcutId_createdAt_idx" ON "StockMovement"("offcutId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_slabId_createdAt_idx" ON "StockMovement"("slabId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_orderId_kind_idx" ON "StockMovement"("orderId", "kind");
