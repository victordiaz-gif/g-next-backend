# Clearing Orders and Marketplace Data (DEV ONLY)

This guide shows how to wipe all Orders and related marketplace tables in your Postgres database for a clean test run. Do NOT use in production.

## What gets cleared
- Core: `order` (cascades to order lines, shipping lines, payments, history, etc.)
- Marketplace plugin: `seller_order`, `ledger_entry`, `vendor_payout`

## Quick SQL (Postgres)
Run against your Vendure database/schema:

```sql
BEGIN;
TRUNCATE TABLE public.vendor_payout RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.ledger_entry RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.seller_order RESTART IDENTITY CASCADE;
TRUNCATE TABLE public."order" RESTART IDENTITY CASCADE;
COMMIT;
```

This cascades to dependent tables like `order_line`, `shipping_line`, `payment`, etc.

## Using psql (env vars)
If you have environment variables:
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USERNAME`
- `DB_PASSWORD`
- `DB_SCHEMA` (default `public`)

Example:
```bash
PGPASSWORD="$DB_PASSWORD" psql \
  -h "$DB_HOST" -p "$DB_PORT" \
  -U "$DB_USERNAME" -d "$DB_NAME" -v ON_ERROR_STOP=1 \
  -c "BEGIN; TRUNCATE TABLE $DB_SCHEMA.vendor_payout RESTART IDENTITY CASCADE; TRUNCATE TABLE $DB_SCHEMA.ledger_entry RESTART IDENTITY CASCADE; TRUNCATE TABLE $DB_SCHEMA.seller_order RESTART IDENTITY CASCADE; TRUNCATE TABLE $DB_SCHEMA.\"order\" RESTART IDENTITY CASCADE; COMMIT;"
```

## Using docker-compose Postgres from this repo
Defaults from `apps/vendure-backend/docker-compose.yml`:
- Host: `localhost`
- Port: `6543`
- DB: `vendure`
- User: `vendure`
- Password: see compose file (`POSTGRES_PASSWORD`)

Example:
```bash
PGPASSWORD="yAXHq2BZB0Hu8NENFJTIBA" psql \
  -h localhost -p 6543 \
  -U vendure -d vendure -v ON_ERROR_STOP=1 \
  -c "BEGIN; TRUNCATE TABLE public.vendor_payout RESTART IDENTITY CASCADE; TRUNCATE TABLE public.ledger_entry RESTART IDENTITY CASCADE; TRUNCATE TABLE public.seller_order RESTART IDENTITY CASCADE; TRUNCATE TABLE public.\"order\" RESTART IDENTITY CASCADE; COMMIT;"
```

## Verify counts
```sql
SELECT 'vendor_payout' AS table, count(*) FROM public.vendor_payout
UNION ALL SELECT 'ledger_entry', count(*) FROM public.ledger_entry
UNION ALL SELECT 'seller_order', count(*) FROM public.seller_order
UNION ALL SELECT 'order', count(*) FROM public."order";
```

## After clearing
- Restart Vendure server
- Ensure your PaymentMethod exists (e.g., `connected-payment-method` from Multivendor)
- Place a fresh multi-seller order and complete payment

> Warning: This operation permanently deletes data. Use only in development/test environments.
