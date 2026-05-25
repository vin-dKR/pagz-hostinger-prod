import HeroSection from "./components/HeroSection";
import CategoryProducts from "./components/CategoryProducts";
import Testimonials from "./components/Testimonials";
import type { Testimonial } from "@/lib/api/reviews";

// NEXT_PUBLIC_* vars are inlined at BUILD time. Falls back to the
// local api so a dev forgetting the env var still gets a working page;
// prod must set NEXT_PUBLIC_API_URL before `next build`.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL

if (!API_BASE_URL) {
    console.log("no API_BASE_URL configured")
}

async function fetchTestimonials(limit = 12): Promise<Testimonial[]> {
    try {
        const response = await fetch(`${API_BASE_URL}/reviews/testimonials?limit=${limit}`, {
            next: { revalidate: 300 },
        });

        if (!response.ok) {
            return [];
        }

        const payload = (await response.json()) as {
            success?: boolean;
            data?: { testimonials?: Testimonial[] };
        };

        if (!payload?.success || !payload.data?.testimonials) {
            return [];
        }

        return payload.data.testimonials;
    } catch {
        return [];
    }
}

export default async function Home() {
    const testimonials = await fetchTestimonials(12);

    return (
        <div className="min-h-screen bg-white pb-36 md:pb-0">
            <HeroSection />
            <CategoryProducts />
            <Testimonials testimonials={testimonials} />
        </div>
    );
}
