import HeroSection from "../components/HeroSection";
import CategoryProducts from "../components/CategoryProducts";
import Testimonials from "../components/Testimonials";
import BottomNavigation from "../components/shared/BottomNavigation";

export default function Home() {
    return (
        <div className="min-h-screen bg-white pb-36 md:pb-0">
            <HeroSection />
            <CategoryProducts />
            <Testimonials />
            <BottomNavigation />
        </div>
    );
}
