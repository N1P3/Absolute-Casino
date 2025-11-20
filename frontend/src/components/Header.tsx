import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import logo from "@/assets/logo_transparent.png?url";
import api from "@/lib/api.ts";
import { useToast } from "@/hooks/use-toast.ts";
import { Menu, User, LogOut, Wallet, ChevronDown } from "lucide-react";

const HeaderDropdownMenu = () => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild className="md:hidden">
        <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-white/10">
          <Menu className="h-6 w-6" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 bg-card border-border text-card-foreground" align="end">
        <DropdownMenuItem asChild>
          <a href="/login" className="cursor-pointer">Zaloguj się</a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href="/register" className="cursor-pointer">Zarejestruj się</a>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-border" />
        <DropdownMenuItem asChild>
          <a href="/" className="cursor-pointer">Home</a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href="/games" className="cursor-pointer">Gry</a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href="/promotions" className="cursor-pointer">Promocje</a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href="/faq" className="cursor-pointer">FAQ</a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const SignedOutSection = () => {
  return (
    <div className="flex items-center gap-4 pl-6">
      <Button variant="ghost" asChild className="text-white hover:text-primary hover:bg-white/5 font-medium">
        <a href="/login">Zaloguj się</a>
      </Button>

      <Button className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold shadow-[0_0_15px_rgba(234,179,8,0.3)] transition-all hover:shadow-[0_0_25px_rgba(234,179,8,0.5)]" asChild>
        <a href="/register">Zarejestruj się</a>
      </Button>
    </div>
  );
};

const SignedInSection = () => {
  const { user, balance } = useAuth();
  const { reload: reloadUserInfo } = useAuth();
  const { toast } = useToast();

  const logout = async () => {
    try {
      await api.get("/api/logout");
      reloadUserInfo();
      toast({
        title: "Zostałeś wylogowany",
        variant: "default",
      });
    } catch {
      toast({
        title: "Błąd podczas wylogowywania",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex items-center gap-4">
      <div className="hidden md:flex flex-col items-end mr-2">
        <span className="text-sm font-medium text-white">{user?.name}</span>
        <span className="text-xs font-bold text-primary">{balance || "0"} zł</span>
      </div>
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="border-primary/30 bg-black/20 text-white hover:bg-primary/10 hover:text-primary hover:border-primary transition-all">
            <User className="h-4 w-4 mr-2" />
            Konto
            <ChevronDown className="h-3 w-3 ml-2 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 bg-card border-border">
          <DropdownMenuItem asChild>
            <a href="/deposit" className="cursor-pointer flex items-center">
              <Wallet className="h-4 w-4 mr-2" /> Depozyt
            </a>
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-border" />
          <DropdownMenuItem onClick={logout} className="cursor-pointer text-red-400 focus:text-red-400 focus:bg-red-950/30">
            <LogOut className="h-4 w-4 mr-2" /> Wyloguj
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

const Header = () => {
  const [scrolled, setScrolled] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header 
      className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 border-b ${
        scrolled 
          ? "bg-background/80 backdrop-blur-md border-border py-3 shadow-lg" 
          : "bg-transparent border-transparent py-5"
      }`}
    >
      <div className="container mx-auto px-4 flex items-center justify-between">
        <a href="/" className="relative z-10 group">
          <div className="absolute -inset-2 bg-primary/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <img className="h-10 md:h-12 relative" src={logo} alt="Absolute Casino" />
        </a>

        <nav className="hidden md:flex items-center gap-8">
          <a href="/games" className="text-sm font-medium text-white/80 hover:text-primary transition-colors uppercase tracking-wide">
            Gry
          </a>
          <a href="/promotions" className="text-sm font-medium text-white/80 hover:text-primary transition-colors uppercase tracking-wide">
            Promocje
          </a>
          <a href="/faq" className="text-sm font-medium text-white/80 hover:text-primary transition-colors uppercase tracking-wide">
            FAQ
          </a>
          
          <div className="h-6 w-px bg-white/10 mx-2"></div>
          
          {user ? <SignedInSection /> : <SignedOutSection />}
        </nav>

        <HeaderDropdownMenu />
      </div>
    </header>
  );
};

export default Header;
