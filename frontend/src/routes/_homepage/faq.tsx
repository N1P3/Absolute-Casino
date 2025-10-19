import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const Route = createFileRoute("/_homepage/faq")({
  component: () => FAQ(),
});

const faqItems = [
  {
    question: "Czy gra w tym kasynie jest legalna?",
    answer: "Tak, nasze kasyno posiada licencję wydaną przez odpowiednie instytucje, co gwarantuje legalność i bezpieczeństwo gry.",
  },
  {
    question: "Jak mogę się zarejestrować?",
    answer: "Aby założyć konto, kliknij przycisk 'Rejestracja' na stronie głównej i wypełnij formularz, podając niezbędne dane osobowe.",
  },
  {
    question: "Czy mogę grać za darmo?",
    answer: "Tak, oferujemy możliwość gry w trybie demo na wielu automatach oraz w niektórych grach stołowych, bez konieczności wpłacania depozytu.",
  },
  {
    question: "Jakie metody płatności są akceptowane?",
    answer: "W naszym kasynie możesz dokonać wpłaty za pomocą kart kredytowych, przelewów bankowych, portfeli elektronicznych oraz kryptowalut.",
  },
  {
    question: "Jak długo trwa wypłata środków?",
    answer: "Czas wypłaty zależy od wybranej metody. Wypłaty na e-portfele są realizowane w ciągu 24 godzin, natomiast przelewy bankowe mogą zająć do 5 dni roboczych.",
  },
  {
    question: "Czy są dostępne bonusy dla nowych graczy?",
    answer: "Tak, nowi gracze mogą otrzymać bonus powitalny w formie dodatkowych środków na grę lub darmowych spinów. Szczegóły znajdziesz w sekcji 'Promocje'.",
  },
  {
    question: "Czy moje dane osobowe są bezpieczne?",
    answer: "Tak, dbamy o bezpieczeństwo danych naszych użytkowników. Nasze kasyno wykorzystuje szyfrowanie SSL oraz inne zaawansowane technologie ochrony danych.",
  },
  {
    question: "Czy mogę grać na urządzeniach mobilnych?",
    answer: "Tak, nasze kasyno jest zoptymalizowane pod kątem urządzeń mobilnych. Możesz grać zarówno na telefonie, jak i tablecie bez konieczności pobierania aplikacji.",
  },
  {
    question: "Czy mogę ustawić limity depozytów?",
    answer: "Tak, aby zapewnić odpowiedzialną grę, umożliwiamy ustawienie limitów depozytów, strat oraz czasu gry. Możesz dostosować limity w ustawieniach konta.",
  },
  {
    question: "Co zrobić, jeśli mam problem z grą lub wypłatą?",
    answer: "Nasz zespół wsparcia klienta jest dostępny 24/7. Skontaktuj się z nami za pomocą czatu na żywo, e-maila lub telefonicznie, a nasi specjaliści pomogą rozwiązać problem.",
  },
];

const FaqItem = ({ faqTitle, faqAnswer, value }: { faqTitle: string; faqAnswer: string; value: string }) => {
  return (
    <AccordionItem value={value} className="">
      <AccordionTrigger className="text-lg text-amber-500">{faqTitle}</AccordionTrigger>
      <AccordionContent className="duration-500">{faqAnswer}</AccordionContent>
    </AccordionItem>
  );
};

const FAQ = () => {
  return (
    <div className="flex justify-center items-center">
      <Card className="container w-[90%] mt-7 bg-gray-900 border-none shadow-xl text-gray-300 px-7">
        <CardHeader>
          <CardTitle className="text-4xl">FAQ</CardTitle>
          <CardDescription className="text-2xl">Szybkie pytania i odpowiedzi</CardDescription>
        </CardHeader>

        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {faqItems.map((f, i) => {
              return <FaqItem value={(i + 1).toString()} faqTitle={f.question} faqAnswer={f.answer} />;
            })}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
};
