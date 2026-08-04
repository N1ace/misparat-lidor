import Link from "next/link";

export function AdminPlaceholder({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: { href: string; label: string };
}) {
  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {action ? (
          <Link className="admin-btn-primary" href={action.href}>
            {action.label}
          </Link>
        ) : null}
      </div>
      <div className="admin-card">
        <h2>מעטפת בלבד</h2>
        <p>
          המסך הזה מוכן כחלק מעיצוב לוח הבקרה. הפיצ׳ר המלא ייבנה בשלב הבא — בינתיים אפשר לנווט בין המסכים
          מהתפריט.
        </p>
      </div>
    </div>
  );
}
