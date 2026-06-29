# Role permission matrix

| Capability | Admin | Manager | Cashier | Waiter | Kitchen roles | Supplier | Cleaner | Customer |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Admin area | Yes | Yes | No | No | No | No | No | No |
| Catalog management | Yes | Yes | No | No | No | No | No | No |
| Inventory management | Yes | Yes | No | No | Cabitaan | No | No | No |
| Staff management | Yes | Yes | No | No | No | No | No | No |
| Supplier management | Yes | Yes | No | No | No | No | No | No |
| All orders | Yes | Yes | Yes | No | No | No | No | No |
| Assigned orders | Yes | Yes | Yes | Yes | No | No | No | No |
| Take payments | Yes | No | Yes | No | No | No | No | No |
| Kitchen tickets | Yes | No | No | No | Assigned station | No | No | No |
| Supplier portal | Yes | No | No | No | No | Yes | No | No |
| Assigned table reset | Yes | No | No | No | No | No | Yes | No |
| Customer ordering | Yes | No | No | No | No | No | No | Yes |

Admin receives every permission automatically. Station and record ownership checks remain mandatory even when a role has the associated scoped permission.
