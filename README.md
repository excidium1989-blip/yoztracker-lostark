# Yoztracker

Ein deutschsprachiger, privater Lost-Ark-Raid-Tracker mit Midnight-Shadow-Design: obsidianschwarze Karten, mitternachtsblaue Rahmen, antikgoldene Gaming-Typografie und cyan leuchtende Raid-Abschlüsse.

## Funktionen

- Geschützter Workspace mit Registrierung, E-Mail-Bestätigung, Anmeldung, Passwortwiederherstellung und Abmeldung.
- Nutzergetrennte Roster: Jedes Konto administriert nur sein eigenes Roster.
- Mehrere öffentliche lostark.bible-Roster importieren und zusammenführen; alternativ Charaktere manuell anlegen, bearbeiten und entfernen.
- Verknüpfte Roster im Importdialog nach Bestätigung entbinden: Link, zugehörige Charaktere, Gold-Auswahlen und Raid-Haken werden gemeinsam aus dem eigenen Workspace und dem verschlüsselten LocalStorage-Cache entfernt. Die Cloud-Speicherung übernimmt die Löschung; offline bleibt sie zur Synchronisierung vorgemerkt. Andere Roster und manuelle Charaktere bleiben erhalten.
- Charaktere in Kachel- und Listenansicht mit antikgoldenen Pfeilen nach oben oder unten verschieben. Die eigene Reihenfolge wird im verschlüsselten LocalStorage-Cache und in der privaten Cloud gespeichert und nach dem Neuladen wieder angezeigt. Bei aktiver Suche oder Klassenfilter werden benachbarte sichtbare Charaktere getauscht; ausgeblendete Charaktere behalten ihre Plätze innerhalb der aktuell gewählten Sortierung. Item-Level- und Namenssortierung bleiben als alternative Ansichten verfügbar und überschreiben die gespeicherte Reihenfolge nicht. Beim Verschieben wird die aktuell gewählte Sortierung zur neuen eigenen Reihenfolge. Neue Charaktere werden hinten angefügt, erneute Imports behalten die Reihenfolge vorhandener Charaktere bei.
- Originale Klassen-Icons, Kachel- und Listenansicht, Namenssuche, Klassenfilter und Sortierung nach Item-Level oder Name.
- Maximal vier verfügbare Raid-Familien je Charakter, jeweils im höchsten freigeschalteten Modus und nach vorgegebenen Mindest-Item-Levels absteigend sortiert. Bei gleichem Item-Level haben neuere Katalogeinträge Vorrang; niedrigere Raids bleiben ausgeblendet. NM, HM, NMM und die drei Horizon-Cathedral-Stages zählen innerhalb ihrer Familie nicht doppelt denselben wöchentlichen Lockout.
- Maximal drei Gold-Raids je Charakter. Der Wochenfortschritt zählt ausschließlich die ausgewählten Gold-Raids.
- Exakte T4-Goldbelohnungen gemäß dem vorgegebenen Roster-Katalog: Nur abgehakte und als GOLD ausgewählte Top-4-Raids bringen Gold. Der Live-Zähler unter dem Titel summiert alle Roster; zusätzliche Anzeigen trennen die Importquellen und manuelle Charaktere. Das Maximum ist die Summe aller aktuell ausgewählten Gold-Raids, unabhängig von Suche und Klassenfilter. Nicht ausgewählte, ausgeblendete oder nicht freigeschaltete Raids zählen nicht mit.
- Wochenwechsel mittwochs um 10:00 UTC: Haken werden zurückgesetzt, Charaktere und Gold-Auswahl bleiben bestehen. Manueller Haken-Reset und JSON-Export sind ebenfalls verfügbar.
- Private Cloud-Speicherung und verschlüsselter Browser-Cache mit Wiederholung ausstehender Änderungen nach Verbindungsproblemen.

## Technologien

React 19, TypeScript, TanStack Start/Router, Vite, CSS, Tailwind CSS 4, Lucide, Zod, Netlify Identity, Netlify Functions, Netlify Database und Drizzle ORM. Die statische Fantasy-Illustration wurde über Netlify AI Gateway erzeugt und wird über Netlify Image CDN ausgeliefert. Die App benötigt keine laufende KI-Inferenz.

## Lokal starten

Voraussetzungen: Node.js 22.12 oder neuer, pnpm und Netlify CLI. Verknüpfe das Projekt mit seiner Netlify-Site, damit Identity und Database verfügbar sind.

```bash
pnpm install
netlify link
netlify dev --port 8889
```

Vite läuft hinter Netlify auf Port 3000. Direktes `pnpm dev` eignet sich nur für die öffentliche Oberfläche; Identity und Functions benötigen den Netlify-Kontext. Die Anmeldung verwendet Secure-Cookies, daher sind HTTPS beziehungsweise eine browserseitig erlaubte sichere localhost-Umgebung erforderlich.

## Deployment

`netlify.toml` konfiguriert Build, Functions und Sicherheitsheader. Netlify Identity wurde über die Plattform-Aktivierung vorbereitet. Die Registrierung erfordert standardmäßig E-Mail-Bestätigung. Netlify Database wird automatisch bereitgestellt; die initiale Migration liegt in `netlify/database/migrations/`. Zusätzliche Supabase- oder Datenbank-Keys sind nicht nötig. Datenbankfehler werden abgefangen, statt das Rendering abzubrechen.

Die Deployment-Pipeline übernimmt Build und Laufzeitprüfung. Während der Erstellung wurden entsprechend den Projektvorgaben keine lokalen Build-, Test-, Typecheck- oder Dev-Server-Kommandos ausgeführt.

## Import-Grenzen

Akzeptiert werden ausschließlich öffentliche HTTPS-Links zu `lostark.bible/character/<region>/<name>/roster`; Links ohne `/roster` werden normalisiert. Regionen wie `CE`, `ce` und `euc` werden unabhängig von der Groß-/Kleinschreibung akzeptiert. Die Region und ihre Schreibweise aus dem eingegebenen Link bleiben für externe Abfragen und verknüpfte Roster-Links unverändert erhalten; das Link-Beispiel im UI verwendet die Region des zuletzt importierten Rosters. Der Import liest SvelteKit-Daten und eingebettetes JSON, ordnet numerische Klassen-IDs zu und führt Charaktere anhand von Region und Name zusammen, wobei die Schreibweise der Region keine Duplikate erzeugt. Redirects, fremde Hosts, übergroße Antworten und lange Requests werden abgewiesen.

lostark.bible ist ein externer Dienst ohne zugesicherte stabile Import-Schnittstelle. Private Roster, Bot-Schutz oder Strukturänderungen können den Import verhindern. Die manuelle Verwaltung bleibt nutzbar. Der Import durchsucht charakterbezogene Statusdaten, unter anderem `raids`, `raidStatus`, `clearedRaids`, `weekly_clears` und `clears`. Er erkennt Katalog-IDs und Raid-Namen mit NM-/HM-/NMM- oder Stage-Angaben sowie explizite Abschlussflags und Abschlussstatus. Abschlüsse werden nur mit einer passenden aktuellen Wochenangabe am Charakter, Statusblock oder einzelnen Raid übernommen; der Zeitpunkt des Imports allein ist kein Nachweis. Unbekannte Raids und nicht freigeschaltete Modi bleiben ausgeschlossen. Normal- und Hard-Clears werden dem gemeinsamen Familien-Lockout und damit dem angezeigten höchsten verfügbaren Modus zugeordnet; eine zusätzliche Checkbox wird nicht erzeugt.

Explizite Gold-Flags wie `gold`, `goldEarn` oder `isGoldEarning` und Listen wie `goldRaids` oder `goldEarnRaids` setzen maximal drei GOLD-Labels innerhalb der Top 4. Eine ausdrücklich leere Gold-Auswahl kann eine frühere Auswahl ersetzen; ohne Gold-Angaben bleibt die bestehende Auswahl erhalten. Fehlende oder veraltete Wochenangaben erzeugen keine neuen Haken und löschen keine vorhandenen manuellen Abschlüsse. Während der Importabfrage manuell geänderte Haken und Gold-Auswahlen bleiben erhalten. Anschließend sind alle importierten Markierungen weiterhin manuell änderbar. Die Importmeldung nennt die Anzahl erkannter aktueller Abschlüsse und Gold-Markierungen. Beim Wochenwechsel werden auch importierte Abschlüsse zurückgesetzt, nicht jedoch die Gold-Auswahl.

Der Browser ruft ausschließlich die eigene Netlify-Importfunktion auf. Diese liest die öffentliche JSON-Antwort serverseitig; damit sind weder direkte Browser-Anfragen an lostark.bible noch ein fremder CORS-Proxy nötig. Der Import unterstützt numerische Klassen-IDs, englische Klassennamen unabhängig von ihrer Schreibweise (etwa `SLAYER` und `SOULEATER`) und die internen lostark.bible-Klassenschlüssel wie `berserker_female`, `soul_eater` und `devil_hunter`. Namen und Item-Level werden validiert, bevor das bestehende Roster aktualisiert wird. Die Startseite ohne Region und Charaktername ist kein importierbarer Roster-Link.

Zeitüberschreitungen, Verbindungsfehler, fehlende Charaktere, Zugriffssperren, zu viele Anfragen und unlesbare Antworten erhalten verständliche deutsche Fehlermeldungen. Ein fehlgeschlagener Import verändert das vorhandene Roster nicht. Erfolgreiche Imports verwenden den nutzergetrennten, verschlüsselten LocalStorage-Cache und die unabhängige Cloud-Speicherung; die Erfolgsmeldung wartet auf den lokalen Schreibversuch, nicht auf die Cloud. Änderungen während einer laufenden Abfrage bleiben beim Zusammenführen erhalten; nach einem Kontowechsel wird die alte Importantwort verworfen.

## Datenschutz

Passwörter verarbeitet ausschließlich Netlify Identity, nicht eine selbstgebaute LocalStorage-Benutzerdatei. Die API ermittelt die Eigentümer-ID aus der geprüften Sitzung, niemals aus dem Request-Body. Schreibende Requests verlangen denselben Origin. Die öffentlichen Charakter-Silhouetten sind dekorativ und enthalten keine aktiven Roster-Daten.

Der LocalStorage-Cache verwendet AES-GCM mit zufälligen Nonces. Ein nicht exportierbarer Geräteschlüssel liegt in IndexedDB. Dies ersetzt keine serverseitige Zugriffskontrolle und schützt nicht gegen kompromittierten Browser-Code. Beim Abmelden verschwindet das aktive Roster aus der Oberfläche; der nutzergetrennte verschlüsselte Cache bleibt für die nächste Anmeldung erhalten. Das Löschen aller Browser-Daten entfernt auch den lokalen Cache. Synchronisierte Daten bleiben in der Cloud. Gleichzeitige Änderungen auf mehreren Geräten folgen „letzte erfolgreiche Speicherung gewinnt“.

Yoztracker ist ein unabhängiges Fan-Projekt. Lost Ark und die originalen Klassen-Icons gehören ihren jeweiligen Rechteinhabern. Die Klassensymbole wurden aus den öffentlich verfügbaren lostark.bible-Klassenassets übernommen. Es besteht keine offizielle Verbindung zu Smilegate, Amazon Games oder lostark.bible.
