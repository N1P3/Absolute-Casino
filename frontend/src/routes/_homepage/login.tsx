import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SubmitHandler, useForm } from "react-hook-form";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import Spinner from "@/components/ui/spinner";
import { useAuth } from "@/components/AuthProvider";

export const Route = createFileRoute("/_homepage/login")({
  component: SignIn,
});

type LoginForm = {
  login: string;
  password: string;
};

export default function SignIn() {
  const form = useForm<LoginForm>();
  const navigate = useNavigate({ from: "/login" });
  const { reload: reloadUserInfo } = useAuth();

  const submitForm: SubmitHandler<LoginForm> = async (data) => {
    try {
      const apiData = {
        login: data.login,
        password: data.password,
      };
      await api.post("/api/authenticate", apiData);
      await navigate({ to: "/" });
      reloadUserInfo();
    } catch {
      form.setError("root", { message: "Nie udało się zalogować." });
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full max-w-4xl pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-3xl"></div>
      </div>

      <Card className="w-full max-w-md p-8 bg-black/40 backdrop-blur-xl border-white/10 shadow-2xl relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">
            Witaj <span className="text-primary">Ponownie</span>
          </h1>
          <p className="text-muted-foreground text-sm">
            Zaloguj się do swojego konta, aby kontynuować grę.
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(submitForm)} className="space-y-6">
            <FormField
              name="login"
              control={form.control}
              rules={{
                required: "Nazwa użytkownika jest wymagana",
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white">Login</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      type="text" 
                      placeholder="janusz213" 
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-primary/50 focus:ring-primary/20"
                    />
                  </FormControl>
                  <FormMessage className="text-red-400 text-xs" />
                </FormItem>
              )}
            />

            <FormField
              name="password"
              control={form.control}
              rules={{ required: "Hasło jest wymagane." }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white">Hasło</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      type="password" 
                      placeholder="********" 
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-primary/50 focus:ring-primary/20"
                    />
                  </FormControl>
                  <FormMessage className="text-red-400 text-xs" />
                </FormItem>
              )}
            />

            {form.formState.errors.root && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm text-center p-3 rounded-md">
                {form.formState.errors.root.message}
              </div>
            )}

            <Button 
              type="submit" 
              disabled={form.formState.isSubmitting}
              className="w-full h-11 text-lg font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_15px_rgba(234,179,8,0.3)] hover:shadow-[0_0_25px_rgba(234,179,8,0.5)] transition-all"
            >
              {form.formState.isSubmitting ? <Spinner /> : "Zaloguj się"}
            </Button>

            <div className="text-center mt-6">
              <p className="text-muted-foreground text-sm">
                Nie masz jeszcze konta?
                <Button variant="link" className="text-primary hover:text-primary/80 font-semibold pl-1" asChild>
                  <a href="/register">Załóż je teraz</a>
                </Button>
              </p>
            </div>
          </form>
        </Form>
      </Card>
    </div>
  );
}
