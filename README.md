# Cafeteria POS System

A production-grade Point of Sale system designed for cafeterias, featuring fast cashier operations, inventory management, sales tracking, reporting, and multi-device support.

## Features

### 1. Cashier Interface
- Touch-optimized tablet UI for fast order entry
- Product grid with category filtering and search
- Real-time totals with tax and discount logic
- Split payment support (cash, card, mixed)
- Receipt snapshot generation after checkout
- Quick-access items and order notes

### 2. Menu and Catalog Management
- Category-based item organization
- Item metadata support (name, price, SKU/barcode, tax profile, status)
- Variant and modifiers-ready data model
- Product images and quick filtering

### 3. Sales and Payment Processing
- Receipt creation with line items
- Multiple payment methods and status tracking
- Discount support (percentage and fixed amount)
- Transaction history with immutable receipt snapshots

### 4. Inventory Management
- Real-time stock tracking per item
- Reorder point alerts
- Append-only inventory ledger with reason tracking
- Low stock notifications and valuation reporting

### 5. Customer Management
- Customer database with contact details
- Purchase history and preferences
- Store credit support

### 6. Employee Management
- Shift open/close workflows
- Cash reconciliation (expected vs counted)
- Over/short reporting
- Shift-to-receipt accountability

### 7. User and Access Control
- Role-based access (Admin, Manager, Cashier)
- Per-store user management
- Active/inactive user status
- Audited user activity logs

### 8. Admin Dashboard
- Sales and inventory overview
- User and store settings management
- Tax and receipt configuration

### 9. Reporting and Analytics
- Daily sales summary
- Filterable transaction history
- Inventory and reconciliation reports
- Employee performance and trend visuals

## Tech Stack

- Frontend: Next.js + React + TypeScript
- Styling: Tailwind CSS
- Backend (target architecture): Supabase (PostgreSQL + Auth + Storage)
- State Management: React Context + Hooks
- Charts: Recharts
- Date Handling: date-fns

## Database Schema (Target)

Core tables:
- `profiles`
- `stores`
- `categories`
- `items`
- `item_variants`
- `modifiers`
- `customers`
- `shifts`
- `receipts`
- `receipt_line_items`
- `payments`
- `inventory_items`
- `inventory_ledger`
- `audit_logs`
- `daily_summaries`

## Design System

Color palette:
- Primary: Blue (`#4F7CFF`)
- Success: Green (`#2E7D32`)
- Warning: Orange (`#F57C00`)
- Destructive: Red (`#D32F2F`)
- Muted: Gray scale for secondary content

Layout principles:
- Desktop-first with mobile adaptation
- Sidebar-driven navigation
- Touch targets of at least 44px
- Responsive grids and card-based surfaces

## Authentication and Authorization

### User Roles
1. Admin
   - Full system access
   - User management
   - Store settings and all reports
2. Manager
   - Menu, inventory, and report management
   - Customer and shift oversight
3. Cashier
   - POS operations
   - Customer lookup
   - Own shift management

### Login Rules
- Username-based authentication
- First registered user becomes Admin
- No email verification requirement
- Minimum password length: 6 characters

## Getting Started

Prerequisites:
- Node.js 18+
- npm

Install and run:

```bash
npm install
npm run dev
```

`npm run dev` now starts both:
- Next.js app on port `3000`
- Kitchen WebSocket server on port `8080`

If you need only the socket server, run:

```bash
npm run ws:server
```

Default socket URL uses your current host at port `8080`. You can override with `NEXT_PUBLIC_KITCHEN_WS_URL`.

Lint:

```bash
npm run lint
```

Open `http://localhost:3000`.

## First-Time Setup

1. Create Admin account
2. Configure store settings (currency, timezone, tax, receipt header/footer)
3. Set up menu categories and items
4. Initialize inventory and reorder points
5. Open shift and start processing sales

## Usage Guide

### Processing a Sale
1. Open shift with opening cash
2. Add items to cart
3. Apply discount if needed
4. Checkout with cash/card/split
5. Complete sale and issue receipt

### Managing Inventory
1. Review stock levels
2. Make stock adjustments with reason
3. Track all movements in the ledger

### Managing Users (Admin)
1. View all users
2. Assign or update roles
3. Activate/deactivate accounts

## Key Concepts

- Split payment: mix cash and card in one receipt
- Inventory tracking: auto deduction on sale + manual audited adjustments
- Shift management: cash control and accountability
- Receipt snapshots: preserve historical line prices

## Reports

- Daily sales summary
- Inventory status and valuation
- Shift reconciliation report
- Employee performance report

## Security

- Row Level Security on core data
- Role-based authorization
- Critical action audit logs
- Secure password handling and session management

## Sample Data

The system is intended to include initial sample categories, items, modifiers, and stock levels for onboarding/demo use.

## Support

For troubleshooting:
1. Check `TODO.md` for known issues
2. Review database migrations and schema files
3. Check browser developer console and server logs

## License

Copyright (c) 2026 Cafeteria POS System
