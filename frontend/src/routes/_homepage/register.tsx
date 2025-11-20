import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SubmitHandler, useForm } from "react-hook-form";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import Spinner from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { AxiosError, isAxiosError } from "axios";
import { useEffect } from "react";

// Typy dla formularza
interface FormValues {
  firstName: string;
  lastName: string;
  email: string;
  login: string;
  password: string;
  confirmPassword: string;
  agreement: boolean;
}

export const Route = createFileRoute("/_homepage/register")({
  component: () => <SignUpCard />,
});

function SignUpCard() {
  const form = useForm<FormValues>();
  const navigate = useNavigate({ from: "/register" });
  const { toast } = useToast();

  const submitForm: SubmitHandler<FormValues> = async (data: FormValues) => {
    try {
      const apiData = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
        login: data.login,
      };
      await api.post("/api/register", apiData);
      await navigate({ to: "/" });
      toast({ title: "Pomyślnie zarejestrowano." });
    } catch (e) {
      if (isAxiosError(e)) {
        form.setError("root", {
          message: typeof e.response?.data === "string" ? e.response.data : "Coś poszło nie tak.",
        });
      }
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full max-w-4xl pointer-events-none z-0">
        <div className="absolute top-0 right-1/4 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-3xl"></div>
      </div>

      <Card className="w-full max-w-2xl p-8 bg-black/40 backdrop-blur-xl border-white/10 shadow-2xl relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">
            Dołącz do <span className="text-primary">Gry</span>
          </h1>
          <p className="text-muted-foreground text-sm">
            Wypełnij formularz, aby stworzyć nowe konto.
          </p>
        </div>

        <Form {...form}>
          <form className="space-y-6" onSubmit={form.handleSubmit(submitForm)}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                name="firstName"
                control={form.control}
                rules={{
                  required: "Imię jest wymagane.",
                  pattern: /^[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]+$/,
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Imię</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Jan" 
                        className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-primary/50 focus:ring-primary/20"
                      />
                    </FormControl>
                    <FormMessage className="text-red-400 text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                name="lastName"
                control={form.control}
                rules={{
                  required: "Nazwisko jest wymagane.",
                  pattern: /^[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]+([ -][A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]+)?$/,
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Nazwisko</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Kowalski" 
                        className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-primary/50 focus:ring-primary/20"
                      />
                    </FormControl>
                    <FormMessage className="text-red-400 text-xs" />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              name="login"
              control={form.control}
              rules={{
                required: "Nazwa użytkownika jest wymagana.",
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white">Nazwa użytkownika</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="janusz213" 
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-primary/50 focus:ring-primary/20"
                    />
                  </FormControl>
                  <FormMessage className="text-red-400 text-xs" />
                </FormItem>
              )}
            />

            <FormField
              name="email"
              control={form.control}
              rules={{
                required: "Email jest wymagany.",
                pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white">Email</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="janusz@mail.com" 
                      type="email" 
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-primary/50 focus:ring-primary/20"
                    />
                  </FormControl>
                  <FormMessage className="text-red-400 text-xs" />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                name="password"
                control={form.control}
                rules={{
                  required: "Hasło jest wymagane.",
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Hasło</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="********" 
                        type="password" 
                        className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-primary/50 focus:ring-primary/20"
                      />
                    </FormControl>
                    <FormMessage className="text-red-400 text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                name="confirmPassword"
                control={form.control}
                rules={{
                  validate: (value) => value === form.getValues("password") || "Hasła nie są takie same.",
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Powtórz hasło</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="********" 
                        type="password" 
                        className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-primary/50 focus:ring-primary/20"
                      />
                    </FormControl>
                    <FormMessage className="text-red-400 text-xs" />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              name="agreement"
              control={form.control}
              rules={{ required: "Zgoda jest wymagana" }}
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        checked={field.value} 
                        onCheckedChange={field.onChange} 
                        className="border-white/50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                      />
                      <FormLabel htmlFor="agreement" className="text-white/80 font-normal">
                        Akceptuję regulamin strony
                      </FormLabel>
                    </div>
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
              {form.formState.isSubmitting ? <Spinner /> : "Zarejestruj się"}
            </Button>
            
            <div className="text-center mt-4">
              <p className="text-muted-foreground text-sm">
                Masz już konto?
                <Button variant="link" className="text-primary hover:text-primary/80 font-semibold pl-1" asChild>
                  <a href="/login">Zaloguj się</a>
                </Button>
              </p>
            </div>
          </form>
        </Form>
      </Card>
    </div>
  );
}
