import { createFileRoute, useNavigate } from "@tanstack/react-router";
import api from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/AuthProvider";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast.ts";
import { Wallet, CreditCard, ArrowRight, Check, Banknote } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_homepage/deposit")({
  component: Deposit,
});

const PRESET_AMOUNTS = [20, 50, 100, 200, 500, 1000];

export default function Deposit() {
  const [deposit, setDeposit] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { reload: reloadUserInfo, balance } = useAuth();

  const handlePresetClick = (amount: number) => {
    setDeposit(amount.toString());
  };

  const submit = async () => {
    const amount = parseFloat(deposit);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Nieprawidłowa kwota",
        description: "Proszę podać poprawną kwotę depozytu.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Simulate a small delay for better UX
      await new Promise((resolve) => setTimeout(resolve, 800));

      const response = await api.get(`/api/deposit?deposit=${amount}`);

      if (response.status === 200) {
        await reloadUserInfo();
        toast({
          title: "Depozyt zakończony sukcesem!",
          description: `Dodano ${amount} PLN do Twojego konta.`,
          className: "bg-green-600 text-white border-none",
        });
        await navigate({ to: "/" });
      }
    } catch {
      toast({
        title: "Błąd transakcji",
        description:
          "Wystąpił problem podczas przetwarzania depozytu. Spróbuj ponownie.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4 bg-gradient-to-b from-gray-900 to-black">
      <Card className="w-full max-w-md bg-gray-900/90 border-gray-800 text-white shadow-2xl backdrop-blur-sm">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent">
              Doładuj konto
            </CardTitle>
            <Wallet className="h-6 w-6 text-yellow-500" />
          </div>
          <CardDescription className="text-gray-400">
            Wybierz kwotę lub wpisz własną.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Current Balance Display */}
          <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 flex justify-between items-center">
            <span className="text-gray-400 text-sm">Aktualne saldo</span>
            <span className="text-xl font-mono font-bold text-green-400">
              {balance} PLN
            </span>
          </div>

          {/* Preset Amounts Grid */}
          <div className="grid grid-cols-3 gap-3">
            {PRESET_AMOUNTS.map((amount) => (
              <Button
                key={amount}
                variant="outline"
                onClick={() => handlePresetClick(amount)}
                className={cn(
                  "h-12 border-gray-700 bg-gray-800/30 hover:bg-yellow-600/20 hover:text-yellow-400 hover:border-yellow-500/50 transition-all",
                  deposit === amount.toString() &&
                    "bg-yellow-600/20 border-yellow-500 text-yellow-400 ring-1 ring-yellow-500"
                )}
              >
                {amount} PLN
              </Button>
            ))}
          </div>

          {/* Custom Amount Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-400">
              Własna kwota (PLN)
            </label>
            <div className="relative">
              <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                type="number"
                placeholder="0.00"
                value={deposit}
                onChange={(e) => setDeposit(e.target.value)}
                className="pl-10 bg-gray-950 border-gray-700 focus:border-yellow-500 focus:ring-yellow-500/20 text-lg"
                min="1"
              />
            </div>
          </div>
        </CardContent>

        <CardFooter>
          <Button
            className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-black transition-all shadow-lg shadow-yellow-900/20"
            onClick={submit}
            disabled={isLoading || !deposit || parseFloat(deposit) <= 0}
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                Przetwarzanie...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Wpłać {deposit ? `${deposit} PLN` : ""}
                <ArrowRight className="h-5 w-5 ml-1" />
              </div>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
