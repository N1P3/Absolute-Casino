import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import logo from "@/assets/logo_transparent.png?url";
import api from "@/lib/api.ts";
import {useToast} from "@/hooks/use-toast.ts";

const HeaderDropdownMenu = () => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="ml-auto md:hidden">
        <button className="md:hidden p-2 justify-self-end">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" />
          </svg>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="bg-white">
        <DropdownMenuItem asChild>
          <a href="#" className="hover:text-amber-400 transition duration-200">
            Zaloguj się
          </a>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <a href="#" className="hover:text-amber-400 transition duration-200">
            Zarejestruj się
          </a>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-black m-1" />

        <DropdownMenuItem asChild>
          <a href="#" className="hover:text-amber-400 transition duration-200">
            Home
          </a>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <a href="#" className="hover:text-amber-400 transition duration-200">
            Gry
          </a>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <a href="#" className="hover:text-amber-400 transition duration-200">
            Promocje
          </a>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <a href="#" className="hover:text-amber-400 transition duration-200">
            FAQ
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const SignedOutSection = () => {
  return (
    <div className="flex space-x-4 pl-6">
      <Button variant="outline" asChild size="lg">
        <a href="/login">Zaloguj się</a>
      </Button>

      <Button size="lg" asChild>
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
        type: "foreground",
        title: "Zostałeś wylogowany",
        variant: "default",
      });
    } catch {
      toast({
        type: "foreground",
        title: "Błąd podczas wylogowywania",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="py-2 px-5 bg-gray-950 rounded-lg shadow flex items-center space-x-4">
      <div className='flex space-x-2'>
        <Button variant="outline">
          <a href="/deposit">Depozyt</a>
        </Button>
        <Button variant="destructive" className="bg-red-500" onClick={() => logout()}>
          Wyloguj
        </Button>
      </div>

      <div>
        <p className="font-bold">{user?.name}</p>
        <p className="text-xs">Saldo: {balance || "0"} zł</p>
      </div>
    </div>
  );
};

const Header = () => {
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);

  useEffect(() => {
    const updateHeaderHeight = () => {
      if (headerRef.current) {
        requestAnimationFrame(() => {
          setHeaderHeight(headerRef.current!.offsetHeight);
        });
      }
    };
    updateHeaderHeight();

    window.addEventListener("resize", updateHeaderHeight);

    return () => {
      window.removeEventListener("resize", updateHeaderHeight);
    };
  }, []);

  const { user } = useAuth();

  return (
    <>
      <header ref={headerRef} className="bg-slate-950 text-white shadow-xl border-b border-b-gray-400 py-3 fixed top-0 left-0 w-full z-50">
        <div className="px-5 mx-auto flex items-center py-4 justify-between gap-4">
          <a href="/">
            {/* Absolute Casino */}
            <img className="max-h-[60px]" src={logo}></img>
          </a>

          <nav className="hidden md:flex space-x-8 ml-auto items-center text-2xl">
            {/* <a href="#" className="hover:text-amber-500 text-amber-300 hover:-translate-y-1 transition duration-200">
              Gry live
            </a>
            <a href="#" className="hover:text-amber-500 text-amber-300 hover:-translate-y-1 transition duration-200">
              Sloty
            </a>
            <a href="#" className="hover:text-amber-500 text-amber-300 hover:-translate-y-1 transition duration-200">
              Promocje
            </a> */}
            <a href="/faq" className="hover:text-amber-500 text-amber-300 hover:-translate-y-1 transition duration-200">
              FAQ
            </a>
            <a href="/rulesAndTerms" className="hover:text-amber-500 text-amber-300 hover:-translate-y-1 transition duration-200">
              Regulamin
            </a>

            {user ? <SignedInSection /> : <SignedOutSection />}
          </nav>

          <HeaderDropdownMenu />
        </div>
      </header>
      <div style={{ height: `${headerHeight}px` }}></div>
    </>
  );
};

export default Header;
