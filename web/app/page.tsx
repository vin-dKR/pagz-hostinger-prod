import HeroSection from "./components/HeroSection";
import CategoryProducts from "./components/CategoryProducts";
import Testimonials from "./components/Testimonials";
import type { Testimonial } from "@/lib/api/reviews";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002/api/v1";

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
