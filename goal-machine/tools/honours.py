"""Honours used for end-of-game badges. Names are matched against the player list (accents/case ignored);
the build prints any name it can't find so typos show up. Only players who reached 50 PL apps matter."""

# https://www.premierleague.com/hall-of-fame (2021-2025 player inductees)
HALL_OF_FAME = """Alan Shearer, Thierry Henry, Eric Cantona, Roy Keane, Frank Lampard, Dennis Bergkamp, Steven Gerrard,
David Beckham, Wayne Rooney, Ian Wright, Patrick Vieira, Vincent Kompany, Peter Schmeichel, Paul Scholes,
Sergio Agüero, Didier Drogba, Tony Adams, Petr Cech, Rio Ferdinand, Andrew Cole, Ashley Cole, John Terry,
Eden Hazard, Gary Neville"""

# Premier League Golden Boot winners up to 2015/16 (later seasons are computed from FPL data)
GOLDEN_BOOT = {
    1992: 'Teddy Sheringham', 1993: 'Andrew Cole', 1994: 'Alan Shearer', 1995: 'Alan Shearer', 1996: 'Alan Shearer',
    1997: 'Dion Dublin, Chris Sutton, Michael Owen', 1998: 'Jimmy Floyd Hasselbaink, Dwight Yorke, Michael Owen',
    1999: 'Kevin Phillips', 2000: 'Jimmy Floyd Hasselbaink', 2001: 'Thierry Henry', 2002: 'Ruud van Nistelrooy',
    2003: 'Thierry Henry', 2004: 'Thierry Henry', 2005: 'Thierry Henry', 2006: 'Didier Drogba',
    2007: 'Cristiano Ronaldo', 2008: 'Nicolas Anelka', 2009: 'Didier Drogba', 2010: 'Dimitar Berbatov, Carlos Tevez',
    2011: 'Robin van Persie', 2012: 'Robin van Persie', 2013: 'Luis Suárez', 2014: 'Sergio Agüero', 2015: 'Harry Kane',
}

WORLD_CUP = {
    1990: 'Jürgen Klinsmann, Karl-Heinz Riedle',
    1998: 'Fabien Barthez, Marcel Desailly, Frank Leboeuf, Emmanuel Petit, Patrick Vieira, Thierry Henry, Robert Pirès, '
          'Youri Djorkaeff, Laurent Blanc, Christophe Dugarry, Christian Karembeu, Bernard Lama, Stéphane Guivarc\'h, Alain Boghossian',
    2002: 'Gilberto Silva, Kléberson, Juninho Paulista, Juliano Belletti, Edmílson, Roque Júnior',
    2006: 'Marco Materazzi',
    2010: 'Fernando Torres, Cesc Fàbregas, Xabi Alonso, Pepe Reina, David Silva, Juan Mata, Jesús Navas, Álvaro Arbeloa, '
          'Fernando Llorente, Pedro, Víctor Valdés',
    2014: 'Mesut Özil, Per Mertesacker, André Schürrle, Lukas Podolski, Shkodran Mustafi, Bastian Schweinsteiger, '
          'Jérôme Boateng, Erik Durm, Ron-Robert Zieler',
    2018: "N'Golo Kanté, Paul Pogba, Olivier Giroud, Hugo Lloris, Benjamin Mendy, Raphaël Varane, Djibril Sidibé, "
          "Alphonse Areola, Steve Mandanda, Florian Thauvin, Steven Nzonzi, Thomas Lemar",
    2022: 'Emiliano Martínez, Alexis Mac Allister, Enzo Fernández, Julián Álvarez, Cristian Romero, Lisandro Martínez, '
          'Nicolás Otamendi, Ángel Di María, Juan Foyth, Guido Rodríguez, Gonzalo Montiel, Thiago Almada',
}

# Champions League / European Cup winners (squad members) who played in the Premier League
CHAMPIONS_LEAGUE = {
    1993: 'Fabien Barthez, Marcel Desailly, Alen Boksic, Didier Deschamps',
    1994: 'Marcel Desailly',
    1995: 'Marc Overmars, Kanu, Finidi George, Edwin van der Sar, Patrick Kluivert, Michael Reiziger, Winston Bogarde',
    1996: 'Gianluca Vialli, Fabrizio Ravanelli, Didier Deschamps',
    1997: 'Karl-Heinz Riedle',
    1998: 'Christian Karembeu',
    1999: 'Peter Schmeichel, Denis Irwin, Gary Neville, Phil Neville, Jaap Stam, Ronny Johnsen, Henning Berg, Wes Brown, '
          'David Beckham, Roy Keane, Paul Scholes, Nicky Butt, Ryan Giggs, Jesper Blomqvist, Dwight Yorke, Andrew Cole, '
          'Teddy Sheringham, Ole Gunnar Solskjaer, Raimond van der Gouw, David May',
    2000: 'Steve McManaman, Nicolas Anelka, Iván Campo, Geremi, Christian Karembeu',
    2001: 'Owen Hargreaves',
    2002: 'Steve McManaman, Claude Makelele, Iván Campo, Geremi',
    2003: 'Andriy Shevchenko',
    2004: 'Ricardo Carvalho, Paulo Ferreira, José Bosingwa, Deco, Nuno Valente, Benni McCarthy, Pedro Mendes',
    2005: 'Jerzy Dudek, Steve Finnan, Jamie Carragher, Sami Hyypiä, Djimi Traoré, John Arne Riise, Steven Gerrard, '
          'Xabi Alonso, Dietmar Hamann, Luis García, Harry Kewell, Milan Baros, Djibril Cissé, Vladimir Smicer, '
          'Igor Biscan, Josemi, Antonio Núñez, Scott Carson',
    2006: 'Juliano Belletti, Sylvinho, Henrik Larsson',
    2008: 'Edwin van der Sar, Wes Brown, Rio Ferdinand, Nemanja Vidic, Patrice Evra, Owen Hargreaves, Michael Carrick, '
          'Paul Scholes, Cristiano Ronaldo, Wayne Rooney, Carlos Tevez, Ryan Giggs, Anderson, Nani, Park Ji-Sung, '
          "John O'Shea, Darren Fletcher, Mikaël Silvestre, Tomasz Kuszczak, Louis Saha, Gerard Piqué",
    2009: 'Thierry Henry, Yaya Touré, Aliaksandr Hleb, Eidur Gudjohnsen, Pedro, Bojan',
    2010: "Mario Balotelli, Samuel Eto'o, Marco Materazzi",
    2011: 'Javier Mascherano, Ibrahim Afellay, Pedro, Bojan',
    2012: 'Petr Cech, José Bosingwa, Gary Cahill, David Luiz, Ashley Cole, John Obi Mikel, Frank Lampard, Salomon Kalou, '
          'Juan Mata, Ryan Bertrand, Didier Drogba, Fernando Torres, Branislav Ivanovic, Ramires, John Terry, Raul Meireles, '
          'Michael Essien, Florent Malouda, Daniel Sturridge, Oriol Romeu, Paulo Ferreira',
    2013: 'Xherdan Shaqiri, Bastian Schweinsteiger, Jérôme Boateng',
    2014: 'Gareth Bale, Xabi Alonso, Álvaro Arbeloa, Casemiro, Raphaël Varane, Álvaro Morata, Ángel Di María',
    2015: 'Pedro, Claudio Bravo, Thomas Vermaelen, Luis Suárez, Jérémy Mathieu',
    2016: 'Gareth Bale, Casemiro, Raphaël Varane, Álvaro Morata, Danilo, Mateo Kovacic',
    2017: 'Gareth Bale, Casemiro, Raphaël Varane, Álvaro Morata, Danilo, Mateo Kovacic, James Rodríguez',
    2018: 'Gareth Bale, Casemiro, Raphaël Varane, Mateo Kovacic, Dani Ceballos',
    2019: 'Alisson Becker, Trent Alexander-Arnold, Joël Matip, Virgil van Dijk, Andrew Robertson, Jordan Henderson, '
          'Fabinho, Georginio Wijnaldum, Mohamed Salah, Roberto Firmino, Sadio Mané, James Milner, Divock Origi, '
          'Joe Gomez, Dejan Lovren, Xherdan Shaqiri, Daniel Sturridge, Naby Keïta, Alex Oxlade-Chamberlain, '
          'Adam Lallana, Alberto Moreno, Simon Mignolet',
    2020: 'Thiago, Philippe Coutinho, Ivan Perisic, Jérôme Boateng',
    2021: 'Édouard Mendy, César Azpilicueta, Thiago Silva, Antonio Rüdiger, Reece James, Ben Chilwell, N\'Golo Kanté, '
          'Jorginho, Mason Mount, Kai Havertz, Timo Werner, Christian Pulisic, Hakim Ziyech, Mateo Kovacic, '
          'Callum Hudson-Odoi, Olivier Giroud, Kurt Zouma, Emerson, Andreas Christensen, Marcos Alonso, Tammy Abraham, '
          'Kepa Arrizabalaga',
    2022: 'Casemiro, Eden Hazard, Gareth Bale, Dani Ceballos, Thibaut Courtois',
    2023: 'Ederson, Kyle Walker, John Stones, Rúben Dias, Nathan Aké, Manuel Akanji, Rodri, Ilkay Gündogan, '
          'Kevin De Bruyne, Bernardo Silva, Jack Grealish, Erling Haaland, Phil Foden, Julián Álvarez, Riyad Mahrez, '
          'Aymeric Laporte, Kalvin Phillips, Rico Lewis, Stefan Ortega',
    2024: 'Joselu, Kepa Arrizabalaga, Antonio Rüdiger, Thibaut Courtois, Dani Ceballos',
}

# Premier League champions by season start year (2025/26 onwards is computed from the FPL fixtures)
CHAMPIONS = {
    1992: 'Manchester United', 1993: 'Manchester United', 1994: 'Blackburn Rovers', 1995: 'Manchester United',
    1996: 'Manchester United', 1997: 'Arsenal', 1998: 'Manchester United', 1999: 'Manchester United',
    2000: 'Manchester United', 2001: 'Arsenal', 2002: 'Manchester United', 2003: 'Arsenal', 2004: 'Chelsea',
    2005: 'Chelsea', 2006: 'Manchester United', 2007: 'Manchester United', 2008: 'Manchester United', 2009: 'Chelsea',
    2010: 'Manchester United', 2011: 'Manchester City', 2012: 'Manchester United', 2013: 'Manchester City',
    2014: 'Chelsea', 2015: 'Leicester City', 2016: 'Chelsea', 2017: 'Manchester City', 2018: 'Manchester City',
    2019: 'Liverpool', 2020: 'Manchester City', 2021: 'Manchester City', 2022: 'Manchester City',
    2023: 'Manchester City', 2024: 'Liverpool',
}


def names(s):
    return [x.strip() for x in s.replace('\n', ' ').split(',') if x.strip()]
