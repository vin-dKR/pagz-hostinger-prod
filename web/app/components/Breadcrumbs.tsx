import Link from "next/link";

interface BreadcrumbItem {
    label: string;
    href?: string;
}

interface BreadcrumbsProps {
    items: BreadcrumbItem[];
}

export default function Breadcrumbs({ items }: BreadcrumbsProps) {
    return (
        <nav className="flex items-center gap-2 text-sm text-gray-600 mb-6">
            {items.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                    {index > 0 && <span className="text-gray-400 text-md">{'>'}</span>}
                    {item.href && index < items.length - 1 ? (
                        <Link href={item.href} className="hover:text-blue-600 transition-colors">
                            {item.label}
                        </Link>
                    ) : (
                        <span className={index === items.length - 1 ? "text-gray-900 font-medium" : ""}>
                            {item.label}
                        </span>
                    )}
                </div>
            ))}
        </nav>
    );
}
