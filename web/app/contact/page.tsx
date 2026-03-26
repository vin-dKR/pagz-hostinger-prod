import Link from "next/link";
import { EnquiryForm } from "./EnquiryForm";

export const metadata = {
    title: "Contact Us | Pagz",
    description: "Contact Pagz support via phone or email.",
};

export default function ContactPage() {
    return (
        <main className="bg-white">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
                <div className="mb-8">
                    <h1 className="text-2xl md:text-3xl font-hkgb font-semibold text-gray-900">Contact Us</h1>
                    <p className="mt-2 text-sm md:text-base text-gray-600">
                        Need help with an order or want to know more about our printing services? Reach out and we’ll get back soon.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <section className="rounded-xl border border-gray-200 p-6">
                        <h2 className="text-lg font-hkgb font-medium text-gray-900">Contact</h2>
                        <div className="mt-4 space-y-2 text-sm text-gray-700">
                            <p>
                                <span className="text-gray-500">Phone:</span>{" "}
                                <a className="text-[#008ECC] hover:underline" href="tel:7500905010">
                                    7500905010
                                </a>
                            </p>
                            <p>
                                <span className="text-gray-500">Email:</span>{" "}
                                <a className="text-[#008ECC] hover:underline" href="mailto:info@pagz.in">
                                    info@pagz.in
                                </a>
                            </p>
                        </div>
                    </section>

                    <section className="rounded-xl border border-gray-200 p-6">
                        <h2 className="text-lg font-hkgb font-medium text-gray-900">Visit Us</h2>
                        <div className="mt-4 space-y-1 text-sm text-gray-700">
                            <p>Amber Chowk, Kahchari</p>
                            <p>Road, Bihar Sharif</p>
                            <p>(Nalanda), pin-803101</p>
                        </div>
                    </section>
                </div>

                {/* Quick WhatsApp enquiry form */}
                <EnquiryForm />

                <section className="mt-6 rounded-xl border border-gray-200 p-6">
                    <h2 className="text-lg font-hkgb font-medium text-gray-900">Follow Us</h2>
                    <p className="mt-2 text-sm text-gray-600">Stay updated with our latest offers and printing updates.</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                        <a
                            href="https://www.facebook.com/profile.php?id=61565966005738"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-full border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:border-[#008ECC] hover:text-[#008ECC] transition-colors"
                        >
                            Facebook
                        </a>
                        <a
                            href="https://www.instagram.com/printiphyindia"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-full border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:border-[#008ECC] hover:text-[#008ECC] transition-colors"
                        >
                            Instagram
                        </a>
                        <a
                            href="https://www.linkedin.com/company/printiphy/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-full border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:border-[#008ECC] hover:text-[#008ECC] transition-colors"
                        >
                            LinkedIn
                        </a>
                        <a
                            href="https://x.com/printiphyindia"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-full border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:border-[#008ECC] hover:text-[#008ECC] transition-colors"
                        >
                            X
                        </a>
                        <a
                            href="https://www.youtube.com/@printiphyIndia"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-full border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:border-[#008ECC] hover:text-[#008ECC] transition-colors"
                        >
                            YouTube
                        </a>
                    </div>
                </section>

                <div className="mt-10 text-sm text-gray-600">
                    <p>
                        Looking for policies? Visit{" "}
                        <Link href="/terms" className="text-[#008ECC] hover:underline">
                            Terms & Conditions
                        </Link>{" "}
                        or{" "}
                        <Link href="/privacy" className="text-[#008ECC] hover:underline">
                            Privacy Policy
                        </Link>
                        .
                    </p>
                </div>
            </div>
        </main>
    );
}

