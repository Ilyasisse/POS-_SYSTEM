import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPen, faTrash } from "@fortawesome/free-solid-svg-icons";

type AdminRowActionsProps = {
  editHref: string;
  deleteLabel?: string;
};

/**
 * Renders shared edit and delete action controls for admin table rows.
 *
 * @param props - Admin row action options.
 * @param props.editHref - The destination path for the edit action.
 * @param props.deleteLabel - Optional accessible label for the delete button.
 * @returns The rendered admin row action controls.
 *
 * @remarks Used by the products, modifiers, modifier groups, and categories admin pages.
 */
export function AdminRowActions({
  editHref,
  deleteLabel = "Delete",
}: AdminRowActionsProps) {
  return (
    <div className="flex items-center gap-2">
      <Link
        href={editHref}
        className="grid size-8 place-items-center rounded-lg text-blue-600 transition hover:bg-blue-50"
        aria-label="Edit"
      >
        <FontAwesomeIcon icon={faPen} className="text-xs" />
      </Link>
      <button
        type="button"
        className="grid size-8 place-items-center rounded-lg text-red-500 transition hover:bg-red-50"
        aria-label={deleteLabel}
      >
        <FontAwesomeIcon icon={faTrash} className="text-xs" />
      </button>
    </div>
  );
}
