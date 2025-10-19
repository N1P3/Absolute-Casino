const blackjack = {
  title: "Blackjack - Instrukcja i Zasady Gry",
  items: [
    {
      title: "Instrukcja gry w Blackjack",
      content: `Blackjack to popularna gra karciana, w której celem jest zdobycie sumy punktów jak najbliższej liczbie 21, bez jej przekroczenia. 
        Każdy gracz gra przeciwko krupierowi, a nie innym graczom.`,
    },
    {
      title: "1. Wartości kart",
      content: `- Karty od 2 do 10 mają swoją nominalną wartość.\n
        - Figury (Walet, Dama, Król) są warte 10 punktów.\n
        - As może być warty 1 lub 11 punktów, w zależności od sytuacji.`,
    },
    {
      title: "2. Rozpoczęcie gry",
      content: `Każdy gracz oraz krupier otrzymują po dwie karty. Gracze widzą swoje karty oraz jedną odkrytą kartę krupiera.`,
    },
    {
      title: "3. Akcje gracza",
      content: `- **Hit (dobierz):** Gracz może dobrać dodatkową kartę, jeśli suma punktów jest mniejsza niż 21.\n
        - **Stand (stań):** Gracz pozostaje przy obecnej sumie punktów.\n
        - **Double Down:** Gracz podwaja zakład i dobiera jedną kartę.\n
        - **Split:** Jeśli gracz ma dwie karty o tej samej wartości, może je rozdzielić na dwa osobne układy.`,
    },
    {
      title: "4. Wygrana",
      content: `Gracz wygrywa, jeśli:\n
        - Jego suma punktów jest bliższa 21 niż suma krupiera.\n
        - Krupier przekroczy 21 punktów (bust).\n
        - Gracz uzyska Blackjack (As + karta warta 10) przy pierwszych dwóch kartach.`,
    },
    {
      title: "5. Zasady krupiera",
      content: `Krupier musi dobierać karty, dopóki suma jego punktów wynosi mniej niż 17. Jeśli przekroczy 21, gracze wygrywają.`,
    },
  ],
};

const mummy = {
  title: "Mumia - Zasady Gry i Bonusy",
  items: [
    {
      title: "Opis gry",
      content: `Maszyna "Mumia" to slot o tematyce egipskiej, który oferuje graczom fascynującą podróż 
        przez starożytny Egipt, gdzie celem jest zdobycie jak najlepszych kombinacji symboli na 
        20 wygrywających liniach. Gra posiada 5 kolumn i 5 rzędów, a na planszy losowo pojawiają się 
        różne symbole, takie jak skarabeusze, diamenty, mumie oraz inne skarby z czasów faraonów. 
        Gra jest dynamiczna, a wygrane są wypłacane na podstawie dopasowania symboli w jednej z 
        20 wygrywających linii. Gracze mają także szansę na aktywowanie ekscytującego bonusu z mumią, 
        który może znacznie zwiększyć wygrane.`,
    },
    {
      title: "1. Zasady gry",
      content: `- Gra odbywa się na planszy 5x5, gdzie symbole są losowo rozmieszczane na kolumnach i rzędach.
        - Maszyna posiada 20 wygrywających linii, które mogą przebiegać w różnych kierunkach (poziomo, pionowo, na ukos).
        - Aby uzyskać wygraną, gracz musi dopasować symbole na jednej z linii wygrywających.
        - Celem gry jest zdobycie jak najlepszych układów symboli, w tym mumii, która uruchamia specjalny bonus.`,
    },
    {
      title: "2. Symbol złotej mumii i aktywacja bonusu",
      content: `- Bonus uruchamia się po wylosowaniu przynajmniej trzech symboli złotej mumii w dowolnych kolumnach.
        - Gdy bonus zostaje aktywowany, gracz otrzymuje trzy darmowe zakręcenia za każdą złotą mumię na planszy.
        - Jeśli w trakcie bonusu na planszy pojawi się napis "MUMMY", gracz otrzymuje aż 20 darmowych zakręceń.`,
    },
    {
      title: "3. Wygrana",
      content: `- Wygrana zależy od układów symboli na wygrywających liniach.
        - Dodatkowo, w trakcie bonusu z mumią, zbieranie diamentów i powiększanie mumii może znacząco zwiększyć szansę na wygraną.`,
    },
  ],
};

const fruitogedon = {
  title: "Fruitogedon - Zasady Gry i Bonusy",
  items: [
    {
      title: "Opis gry",
      content: `Fruitogedon to owocowy slot z dynamiczną rozgrywką, który rozgrywa się na planszy o układzie 5 kolumn i 3 wierszy. 
        Celem gry jest dopasowanie symboli owoców na jednej z 20 wygrywających linii, które przebiegają w różnych kierunkach: 
        poziomo, pionowo i na ukos. Symbole to klasyczne owoce, takie jak wiśnie, cytryny, truskawki i arbuzy, a także symbol Wild, 
        który pełni kluczową rolę w aktywowaniu bonusów.`,
    },
    {
      title: "1. Zasady gry",
      content: `- Gra odbywa się na planszy 5x3 z 20 wygrywającymi liniami.
        - Aby uzyskać wygraną, gracz musi dopasować symbole owoców na jednej z wygrywających linii.
        - Wild zastępuje dowolny symbol na planszy, zwiększając szanse na wygraną.
        - Kolejność wartości symboli od najmniejszego do największego to: wiśnie, cytryna, pomarańcza, truskawka, winogrona, arbuz, Wild.`,
    },
    {
      title: "2. Symbol Wild i jego funkcje",
      content: `- Symbol Wild działa jako joker, zastępując każdy inny symbol w grze.
        - Wild pełni również kluczową rolę w aktywowaniu bonusu.`,
    },
    {
      title: "3. Aktywacja bonusu i respiny",
      content: `- Bonus uruchamia się, gdy trzy symbole Wild pojawią się w jednej kolumnie.
        - Gdy bonus zostaje aktywowany, Wildy pozostają w kolumnie, a gracz otrzymuje trzy darmowe respiny.
        - Jeśli podczas bonusu pojawią się kolejne symbole Wild w innej kolumnie, bonus wydłuża się o dodatkowe trzy respiny, ale tylko dla nowo pojawionych Wildów.
        - Wildy znikają po wykorzystaniu swoich trzech respinów.`,
    },
    {
      title: "4. Jackpoty",
      content: `- W grze Fruitogedon dostępne są trzy rodzaje jackpotów: Minor, Major i Grand.
    - Jackpot Minor: Aktywowany, gdy na jednej wygrywającej linii pojawią się same symbole Wild.
    - Jackpot Major: Aktywowany, gdy na dwóch wygrywających liniach pojawią się same symbole Wild.
    - Jackpot Grand: Najwyższy jackpot w grze, aktywowany, gdy na trzech wygrywających liniach pojawią się same symbole Wild.
    - Jackpoty są szansą na zdobycie największych wygranych w grze i występują niezależnie od innych bonusów.`,
    },
    {
      title: "5. Wygrana",
      content: `- Wygrane są wypłacane na podstawie kombinacji symboli na wygrywających liniach.
        - Wartość wygranej zależy od kombinacji symboli zgodnie z ich mnożnikami, które rosną w kolejności: 
        wiśnie, cytryna, pomarańcza, truskawka, winogrona, arbuz, Wild.`,
    },
  ],
};

const baccarat = {
  title: "Baccarat - Zasady Gry i Rozgrywka",
  items: [
    {
      title: "Opis gry",
      content: `Baccarat to popularna gra karciana rozgrywana między dwoma rękami: Graczem (Player) i Bankierem (Banker). 
        Celem gry jest obstawienie, która ręka będzie miała wartość punktową bliższą 9 lub czy wynik będzie remisem (Tie). 
        Gra jest szybka, prosta do zrozumienia i oferuje wysokie emocje.`,
    },
    {
      title: "1. Zasady podstawowe",
      content: `- Baccarat rozgrywany jest za pomocą od jednego do ośmiu standardowych talii kart (każda zawiera 52 karty).
        - Wartość kart:
          - Asy: 1 punkt.
          - Karty od 2 do 9: ich wartość nominalna.
          - 10, Walet, Dama, Król: 0 punktów.
        - Punkty ręki obliczane są poprzez dodanie wartości kart i odrzucenie dziesiątek (np. 15 punktów to 5).`,
    },
    {
      title: "2. Przebieg gry",
      content: `- Gracz obstawia jedną z trzech możliwości: Gracz (Player), Bankier (Banker) lub Remis (Tie).
        - Rozdający rozdaje po dwie karty zarówno Graczowi, jak i Bankierowi.
        - W zależności od sumy punktów rąk może zostać dobrana trzecia karta, zgodnie z ustalonymi zasadami.`,
    },
    {
      title: "3. Zasady dobierania kart",
      content: `- Gracz:
          - Jeśli suma punktów Gracza wynosi 0-5, Gracz dobiera trzecią kartę.
          - Jeśli suma wynosi 6-7, Gracz nie dobiera.
          - Jeśli suma wynosi 8-9, jest to naturalna wygrana i żadna ręka nie dobiera kart.
        - Bankier:
          - Zasady Bankiera zależą od wyniku Gracza i sumy punktów Bankiera:
            - Jeśli suma Bankiera wynosi 0-2, dobiera trzecią kartę.
            - Jeśli suma wynosi 3-6, Bankier dobiera lub pasuje w zależności od trzeciej karty Gracza.
            - Jeśli suma wynosi 7, Bankier pasuje.
            - Jeśli suma wynosi 8-9, Bankier nie dobiera.`,
    },
    {
      title: "4. Wypłaty",
      content: `- Zakład na Gracza (Player): Wygrana wypłacana 1:1.
        - Zakład na Bankiera (Banker): Wygrana wypłacana 1:1, ale z prowizją 5%.
        - Zakład na Remis (Tie): Wygrana wypłacana 8:1.`,
    },
    {
      title: "5. Zasady specjalne",
      content: `- Naturalna wygrana: Jeśli Gracz lub Bankier uzyska 8 lub 9 punktów w pierwszych dwóch kartach, runda kończy się natychmiast.
        - Remis: Jeśli Gracz i Bankier mają tę samą liczbę punktów, runda kończy się remisem.`,
    },
    {
      title: "6. Strategie i porady",
      content: `- Zakład na Bankiera ma najniższą przewagę kasyna, co czyni go najbezpieczniejszym wyborem.
        - Zakład na Remis ma wysoką wypłatę, ale przewaga kasyna jest znacznie większa.
        - Obserwowanie wyników poprzednich rund może pomóc w decyzji o zakładach, ale wyniki są całkowicie losowe.`,
    },
  ],
};



const instructionsConfig = {
  blackjack,
  mummy,
  fruitogedon,
  baccarat
};

export default instructionsConfig;
