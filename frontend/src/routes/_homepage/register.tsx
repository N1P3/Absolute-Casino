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
      console.log("dzialam");

      const apiData = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
        login: data.login,
      };
      await api.post("/api/register", apiData);
      await navigate({ to: "/" });
      toast({ title: "Pomyślnie zarejstrowano." });
    } catch (e) {
      if (isAxiosError(e)) {
        form.setError("root", {
          message: typeof e.response?.data === "string" ? e.response.data : "Coś poszło nie tak.",
        });
      }
    }
  };

  useEffect(() => {
    console.log(form.formState.errors);
  }, [form.formState.errors]);

  return (
    <div className="min-h-[80vh] flex md:items-center justify-center mt-5 md:mt-6 mb-3">
      <Card className="md:p-5 bg-none flex flex-col items-center border-none shadow-none md:bg-gray-900 md:shadow-xl text-white">
        {/* <div className="bg-gradient-to-r from-amber-500 to-amber-600 flex flex-col gap-2 rounded-2xl text-black py-2 px-4 w-[90%]">
          <h4 className="text-2xl font-bold">Zarejestruj się</h4>
          <p className="mt-1">Witaj! Wypełnij formularz aby się zarejstrować.</p>
        </div> */}
        <h1 className="text-left font-extrabold uppercase text-3xl italic">Rejestracja</h1>

        <Form {...form}>
          <form className="w-80 max-w-screen-lg sm:w-96 px-10 mt-4 flex flex-col space-y-4" onSubmit={form.handleSubmit(submitForm)}>
            <FormField
              name="firstName"
              control={form.control}
              rules={{
                required: "Imię jest wymagane.",
                pattern: /^[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]+$/,
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Imię</FormLabel>
                  <FormControl>
                    <Input value={field.value} onChange={field.onChange} placeholder="Jan" />
                  </FormControl>
                  <FormMessage className="text-red-500 text-xs" />
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
                  <FormLabel>Nazwisko</FormLabel>
                  <FormControl>
                    <Input value={field.value} onChange={field.onChange} placeholder="Kowalski" />
                  </FormControl>
                  <FormMessage className="text-red-500 text-xs" />
                </FormItem>
              )}
            />

            <FormField
              name="login"
              control={form.control}
              rules={{
                required: "Nazwa użytkownika jest wymagana.",
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nazwa użytkownika</FormLabel>
                  <FormControl>
                    <Input value={field.value} onChange={field.onChange} placeholder="Kowalski" />
                  </FormControl>
                  <FormMessage className="text-red-500 text-xs" />
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
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input value={field.value} onChange={field.onChange} placeholder="janusz@mail.com" type="email" />
                  </FormControl>
                  <FormMessage className="text-red-500 text-xs" />
                </FormItem>
              )}
            />

            <FormField
              name="password"
              control={form.control}
              rules={{
                required: "Hasło jest wymagane.",
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hasło</FormLabel>
                  <FormControl>
                    <Input value={field.value} onChange={field.onChange} placeholder="********" type="password" />
                  </FormControl>
                  <FormMessage className="text-red-500 text-xs" />
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
                  <FormLabel>Powtórz hasło</FormLabel>
                  <FormControl>
                    <Input value={field.value} onChange={field.onChange} placeholder="********" type="password" />
                  </FormControl>
                  <FormMessage className="text-red-500 text-xs" />
                </FormItem>
              )}
            />

            <FormField
              name="agreement"
              control={form.control}
              rules={{ required: "Zgoda jest wymagana" }}
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <div className="flex items-center space-x-2">
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      <FormLabel htmlFor="agreement">Akceptuję regulamin strony</FormLabel>
                    </div>
                  </FormControl>
                  <FormMessage className="text-red-500 text-xs" />
                </FormItem>
              )}
            />

            {form.formState.errors.root && <div className="text-red-500 text-center mt-3 text-xs p-3 rounded-md">{form.formState.errors.root.message}</div>}

            <Button type="submit">{form.formState.isSubmitting ? <Spinner /> : "Zarejestruj się"}</Button>
          </form>
        </Form>
      </Card>
    </div>
  );
}
