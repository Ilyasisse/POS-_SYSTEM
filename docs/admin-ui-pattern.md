# Canonical admin UI pattern

Admin pages compose the shared shadcn primitives directly. Do not add new
`AdminUi` wrappers.

## Imports

```tsx
import { PageHeader } from "@/components/ui/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
```

## Page composition

Use a responsive page container, `PageHeader` for the title and actions, Card
for filters/forms/summary content, and the shadcn Table component for data. The
Table component owns horizontal overflow, so pages must not add viewport-wide
overflow wrappers.

```tsx
<div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6">
  <PageHeader
    eyebrow="Operations"
    title="Feature title"
    description="Short task-oriented description."
    actions={<Button>Primary action</Button>}
  />
  <Card>
    <CardHeader>
      <CardTitle>Section title</CardTitle>
    </CardHeader>
    <CardContent>{/* shadcn fields or table */}</CardContent>
  </Card>
</div>
```

Use semantic `Badge` variants/classes for status, `Alert` with an appropriate
live region for action feedback, visible `Label` elements for fields, and
`AlertDialog` before destructive actions. Preserve server-action field names
and URL search parameters.

## Navigation extension

The shared desktop and mobile shell consume
`src/components/admin/layout/admin-navigation.ts`. Add one typed item there
with its permission and optional count key. Do not add route-specific rendering
branches to `AdminShell`.
