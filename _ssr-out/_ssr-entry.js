import React, { useEffect, useMemo, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "fs";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
//#region _lucide.mjs
var Icon = (props) => React.createElement("svg", props);
var Clock3 = Icon;
var Coins = Icon;
var Flame = Icon;
var Gamepad2 = Icon;
var Layers3 = Icon;
var LibraryBig = Icon;
var TrendingUp = Icon;
var WalletCards = Icon;
//#endregion
//#region _ptypes.mjs
var raw = fs.readFileSync("./data/steam.json", "utf8");
var steam$1 = JSON.parse(raw);
var getPortfolioConfig = () => ({ steam: steam$1 });
//#endregion
//#region src/react/SteamActivityDashboard.tsx
var LIST_INTERVAL = 4800;
getPortfolioConfig().steam;
function InsightMeterList({ items = [] }) {
	const max = Math.max(1, ...items.map((item) => Number(item.value || 0)));
	return /* @__PURE__ */ jsx("div", {
		className: "insight-meter-list",
		children: items.slice(0, 7).map((item) => /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsxs("span", { children: [/* @__PURE__ */ jsx("b", { children: item.label }), /* @__PURE__ */ jsx("small", { children: item.note || Number(item.value || 0).toLocaleString("en-AU") })] }), /* @__PURE__ */ jsx("i", { children: /* @__PURE__ */ jsx("em", { style: { width: `${Math.max(7, Number(item.value || 0) / max * 100)}%` } }) })] }, item.label))
	});
}
function money(value, currency = "AUD") {
	if (value === null || value === void 0) return "Not logged";
	if (!Number.isFinite(Number(value))) return "Not logged";
	return new Intl.NumberFormat("en-AU", {
		style: "currency",
		currency,
		maximumFractionDigits: 2
	}).format(Number(value));
}
function GenreFingerprint({ genres = [] }) {
	const palette = [
		"#55d5c4",
		"#ffbf5a",
		"#ff5b61",
		"#5f9cff",
		"#78d96b",
		"#d47cff"
	];
	const visible = genres.slice(0, 6);
	const total = Math.max(1, visible.reduce((sum, genre) => sum + Number(genre.value || 0), 0));
	let cursor = 0;
	const segments = visible.map((genre, index) => {
		const start = cursor;
		cursor += Number(genre.value || 0) / total * 100;
		return `${palette[index % palette.length]} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
	});
	const top = visible[0];
	return /* @__PURE__ */ jsxs("div", {
		className: "genre-fingerprint",
		children: [/* @__PURE__ */ jsx("div", {
			className: "genre-ring",
			style: { "--genre-ring": visible.length ? `conic-gradient(${segments.join(",")})` : "conic-gradient(var(--line) 0 100%)" },
			children: /* @__PURE__ */ jsxs("span", { children: [
				/* @__PURE__ */ jsx("small", { children: "Top genre" }),
				/* @__PURE__ */ jsx("strong", { children: top?.label || "Building" }),
				/* @__PURE__ */ jsx("b", { children: top ? `${Math.round(Number(top.value || 0) / total * 100)}%` : "--" })
			] })
		}), /* @__PURE__ */ jsx("div", {
			className: "genre-legend",
			children: visible.map((genre, index) => /* @__PURE__ */ jsxs("div", { children: [
				/* @__PURE__ */ jsx("i", { style: { background: palette[index % palette.length] } }),
				/* @__PURE__ */ jsxs("span", { children: [/* @__PURE__ */ jsx("strong", { children: genre.label }), /* @__PURE__ */ jsxs("small", { children: [Number(genre.value || 0).toLocaleString("en-AU"), " sampled hrs"] })] }),
				/* @__PURE__ */ jsxs("b", { children: [Math.round(Number(genre.value || 0) / total * 100), "%"] })
			] }, genre.label))
		})]
	});
}
function parseHoursFromMeta(item) {
	const match = String(item.note || item.meta || "").match(/([\d,.]+)\s*hrs?/i);
	if (!match) return Number(item.playtimeMinutes || 0) / 60;
	return Number(String(match[1]).replace(/,/g, "")) || 0;
}
function getDeepDiveGames(steam) {
	const insights = steam.insights || {};
	return (insights.ownedGames?.length ? insights.ownedGames : steam.mostPlayed || []).filter((item) => {
		const minutes = Number(item.playtimeMinutes || 0);
		if (minutes >= 6e3) return true;
		if (minutes) return false;
		return parseHoursFromMeta(item) >= 100;
	}).slice().sort((a, b) => parseHoursFromMeta(b) - parseHoursFromMeta(a));
}
function PlaystyleView({ steam }) {
	const [deepDiveOpen, setDeepDiveOpen] = useState(false);
	const insights = steam.insights || {};
	const spending = steam.spending || {};
	const currency = spending.currency || "AUD";
	const loggedGames = (spending.games || []).filter((game) => game.title && Number.isFinite(Number(game.amount)));
	const highestLogged = spending.highestGame?.title ? spending.highestGame : [...loggedGames].sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))[0];
	const controller = Number(steam.replay?.controllerPercent || 0);
	const retail = insights.retailEstimate;
	const retailCurrency = retail?.currency || currency;
	const highestRetail = retail?.highestGame;
	const playstyle = insights.playstyle?.length ? insights.playstyle : [{
		label: "Controller",
		value: controller,
		note: `${controller}% of Replay`
	}, {
		label: "Keyboard, mouse + other",
		value: 100 - controller,
		note: `${100 - controller}% of Replay`
	}];
	const deepDiveGames = getDeepDiveGames(steam);
	const habitStats = [
		{
			icon: Clock3,
			value: `${Number(insights.averageHoursPerGame || 0)} hrs`,
			label: "Average per owned game",
			note: "Total public playtime divided by owned games."
		},
		{
			icon: Flame,
			value: Number(insights.deepDiveGames || 0).toLocaleString("en-AU"),
			label: "Deep-dive games",
			note: "Games with at least 100 hours played.",
			clickable: true
		},
		{
			icon: LibraryBig,
			value: Number(insights.lowPlaytimeGames || 0).toLocaleString("en-AU"),
			label: "Low-playtime library",
			note: "Games with under two hours recorded."
		},
		{
			icon: Layers3,
			value: Number(insights.availableDlcCount || 0).toLocaleString("en-AU"),
			label: "DLC listings detected",
			note: `Available across ${insights.metadataSampleSize || 0} sampled Store pages, not confirmed purchases.`
		}
	];
	return /* @__PURE__ */ jsxs("div", {
		className: "steam-playstyle-profile",
		children: [
			/* @__PURE__ */ jsxs("section", {
				className: "playstyle-block",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "insight-subhead",
					children: [/* @__PURE__ */ jsx("span", { children: "Genre fingerprint" }), /* @__PURE__ */ jsx("small", { children: "weighted by playtime across sampled Store metadata" })]
				}), /* @__PURE__ */ jsx(GenreFingerprint, { genres: insights.genreMix })]
			}),
			/* @__PURE__ */ jsxs("section", {
				className: "playstyle-block",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "insight-subhead",
					children: [/* @__PURE__ */ jsx("span", { children: "How the library gets played" }), /* @__PURE__ */ jsx("small", { children: "Steam public playtime + Replay input data" })]
				}), /* @__PURE__ */ jsxs("div", {
					className: "playstyle-balance",
					children: [/* @__PURE__ */ jsxs("div", {
						className: "steam-playstyle-visual",
						children: [/* @__PURE__ */ jsx(Gamepad2, { "aria-hidden": "true" }), /* @__PURE__ */ jsxs("span", { children: [/* @__PURE__ */ jsxs("strong", { children: [controller, "%"] }), /* @__PURE__ */ jsx("small", { children: "controller playtime in Replay" })] })]
					}), /* @__PURE__ */ jsx(InsightMeterList, { items: playstyle })]
				})]
			}),
			/* @__PURE__ */ jsx("section", {
				className: "playstyle-habit-grid",
				children: habitStats.map(({ icon: Icon, value, label, note, clickable }) => clickable ? /* @__PURE__ */ jsxs("button", {
					type: "button",
					className: `playstyle-habit-card${deepDiveOpen ? " is-open" : ""}`,
					"aria-expanded": deepDiveOpen,
					onClick: () => setDeepDiveOpen((open) => !open),
					children: [/* @__PURE__ */ jsx(Icon, { "aria-hidden": "true" }), /* @__PURE__ */ jsxs("span", { children: [
						/* @__PURE__ */ jsx("strong", { children: value }),
						/* @__PURE__ */ jsx("b", { children: label }),
						/* @__PURE__ */ jsx("small", { children: note }),
						/* @__PURE__ */ jsx("em", {
							className: "playstyle-habit-hint",
							children: deepDiveOpen ? "Hide games" : "Tap to view"
						})
					] })]
				}, label) : /* @__PURE__ */ jsxs("article", { children: [/* @__PURE__ */ jsx(Icon, { "aria-hidden": "true" }), /* @__PURE__ */ jsxs("span", { children: [
					/* @__PURE__ */ jsx("strong", { children: value }),
					/* @__PURE__ */ jsx("b", { children: label }),
					/* @__PURE__ */ jsx("small", { children: note })
				] })] }, label))
			}),
			deepDiveOpen && /* @__PURE__ */ jsx("section", {
				className: "deep-dive-reveal",
				"aria-label": "Deep-dive games list",
				children: deepDiveGames.length ? /* @__PURE__ */ jsx(GameList, {
					items: deepDiveGames,
					label: "Deep-dive games",
					pageSize: 4
				}) : /* @__PURE__ */ jsx("p", {
					className: "game-note",
					children: "Deep-dive games will appear after the next Steam refresh."
				})
			}),
			/* @__PURE__ */ jsxs("section", {
				className: "playstyle-lower-grid",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "dlc-profile",
					children: [/* @__PURE__ */ jsxs("div", {
						className: "insight-subhead",
						children: [/* @__PURE__ */ jsx("span", { children: "DLC-heavy game ecosystems" }), /* @__PURE__ */ jsx("small", { children: "Store availability, not purchase history" })]
					}), /* @__PURE__ */ jsxs("ol", { children: [(insights.dlcHeavyGames || []).slice(0, 5).map((game, index) => /* @__PURE__ */ jsxs("li", { children: [
						/* @__PURE__ */ jsx("span", { children: String(index + 1).padStart(2, "0") }),
						/* @__PURE__ */ jsx(SteamArtwork, {
							item: game,
							title: game.title || "Steam game",
							className: "dlc-game-art"
						}),
						/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("strong", { children: game.title }), /* @__PURE__ */ jsx("small", { children: game.meta })] }),
						/* @__PURE__ */ jsxs("b", { children: [Number(game.dlcAvailable || 0), " DLC"] })
					] }, game.appid || game.title)), !insights.dlcHeavyGames?.length && /* @__PURE__ */ jsx("li", {
						className: "playstyle-empty",
						children: "DLC metadata will appear after the next Steam refresh."
					})] })]
				}), /* @__PURE__ */ jsxs("div", {
					className: "spending-profile",
					children: [
						/* @__PURE__ */ jsxs("div", {
							className: "insight-subhead",
							children: [/* @__PURE__ */ jsx("span", { children: "Retail value estimate" }), /* @__PURE__ */ jsxs("small", { children: [retail?.sampledGames || 0, " owned-game Store pages sampled"] })]
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "spending-summary",
							children: [
								/* @__PURE__ */ jsxs("article", { children: [/* @__PURE__ */ jsx(WalletCards, { "aria-hidden": "true" }), /* @__PURE__ */ jsxs("span", { children: [/* @__PURE__ */ jsx("small", { children: "Library value" }), /* @__PURE__ */ jsx("strong", { children: steam.accountValue?.value || "Not logged" })] })] }),
								/* @__PURE__ */ jsxs("article", { children: [/* @__PURE__ */ jsx(Coins, { "aria-hidden": "true" }), /* @__PURE__ */ jsxs("span", { children: [/* @__PURE__ */ jsx("small", { children: "Total personally logged" }), /* @__PURE__ */ jsx("strong", { children: money(spending.totalSpent, currency) })] })] }),
								/* @__PURE__ */ jsxs("article", { children: [/* @__PURE__ */ jsx(TrendingUp, { "aria-hidden": "true" }), /* @__PURE__ */ jsxs("span", { children: [
									/* @__PURE__ */ jsx("small", { children: "Highest sampled retail estimate" }),
									/* @__PURE__ */ jsx("strong", { children: highestRetail?.title || "Awaiting Store prices" }),
									/* @__PURE__ */ jsx("b", { children: money(highestRetail?.amount, retailCurrency) })
								] })] })
							]
						}),
						retail?.topGames?.length ? /* @__PURE__ */ jsx("ol", {
							className: "spending-game-list",
							children: retail.topGames.map((game) => /* @__PURE__ */ jsxs("li", { children: [/* @__PURE__ */ jsxs("span", { children: [/* @__PURE__ */ jsx("strong", { children: game.title }), /* @__PURE__ */ jsxs("small", { children: [
								"Base ",
								money(game.baseAmount, game.currency || retailCurrency),
								" + ",
								game.confirmedDlcCount || 0,
								" confirmed DLC ",
								money(game.dlcAmount, game.currency || retailCurrency)
							] })] }), /* @__PURE__ */ jsx("b", { children: money(game.amount, game.currency || retailCurrency) })] }, game.appid || game.title))
						}) : /* @__PURE__ */ jsx("p", {
							className: "spending-pending",
							children: "Store-price estimates will appear after the next Steam refresh."
						}),
						/* @__PURE__ */ jsx("p", {
							className: "spending-method",
							children: retail?.method || "Full-price Store estimate only. Steam does not expose purchase receipts or public DLC ownership."
						}),
						loggedGames.length > 0 && /* @__PURE__ */ jsxs("p", {
							className: "spending-method",
							children: [
								"Actual amounts manually logged for ",
								loggedGames.length,
								" game",
								loggedGames.length === 1 ? "" : "s",
								"; highest logged: ",
								highestLogged?.title,
								" at ",
								money(highestLogged?.amount, currency),
								"."
							]
						})
					]
				})]
			})
		]
	});
}
function useCyclingWindow(items = [], pageSize = 6) {
	const [start, setStart] = useState(0);
	const [swapping, setSwapping] = useState(false);
	useEffect(() => {
		setStart(0);
		setSwapping(false);
		if (items.length <= pageSize || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
		let swapTimer = 0;
		let frame = 0;
		const timer = window.setInterval(() => {
			setSwapping(true);
			swapTimer = window.setTimeout(() => {
				setStart((value) => (value + pageSize) % items.length);
				frame = window.requestAnimationFrame(() => setSwapping(false));
			}, 260);
		}, LIST_INTERVAL);
		return () => {
			window.clearInterval(timer);
			window.clearTimeout(swapTimer);
			window.cancelAnimationFrame(frame);
		};
	}, [items, pageSize]);
	return {
		visible: items.length <= pageSize ? items : Array.from({ length: pageSize }, (_, offset) => items[(start + offset) % items.length]),
		swapping,
		start
	};
}
function editionText(edition) {
	if (typeof edition === "string") return edition;
	const label = edition.label || edition.name || "Edition";
	return edition.price ? `${label}: ${edition.price}` : label;
}
function artworkCandidates(item) {
	const candidates = [];
	const primary = String(item.image || "").trim().replace(/^http:\/\//i, "https://");
	if (primary) {
		candidates.push(primary.replace("shared.akamai.steamstatic.com", "shared.fastly.steamstatic.com"));
		if (primary.includes("shared.fastly.steamstatic.com")) candidates.push(primary.replace("shared.fastly.steamstatic.com", "shared.akamai.steamstatic.com"));
	}
	if (item.appid) candidates.push(`https://cdn.cloudflare.steamstatic.com/steam/apps/${item.appid}/header.jpg`);
	return [...new Set(candidates)];
}
function SteamArtwork({ item, title, className = "game-art" }) {
	const candidates = useMemo(() => artworkCandidates(item), [item.appid, item.image]);
	const [candidateIndex, setCandidateIndex] = useState(0);
	useEffect(() => setCandidateIndex(0), [candidates]);
	if (!candidates[candidateIndex]) return /* @__PURE__ */ jsx("span", {
		className: `${className} game-art-placeholder`,
		role: "img",
		"aria-label": `${title} artwork unavailable`,
		children: "Steam"
	});
	return /* @__PURE__ */ jsx("img", {
		className,
		src: candidates[candidateIndex],
		alt: `${title} artwork`,
		loading: "lazy",
		decoding: "async",
		onError: () => setCandidateIndex((value) => value + 1)
	});
}
function GameItem({ item, index = 0 }) {
	const title = item.title || item.name || "Untitled game";
	const hasArtwork = Boolean(item.image || item.appid);
	const body = /* @__PURE__ */ jsxs(Fragment, { children: [
		item.url ? /* @__PURE__ */ jsx("a", {
			className: "game-title",
			href: item.url,
			target: "_blank",
			rel: "noopener noreferrer",
			children: title
		}) : /* @__PURE__ */ jsx("span", {
			className: "game-title",
			children: title
		}),
		item.meta && /* @__PURE__ */ jsx("span", {
			className: "game-meta",
			children: item.meta
		}),
		(item.price || item.originalPrice || item.discount) && /* @__PURE__ */ jsxs("span", {
			className: "game-price-row",
			children: [
				/* @__PURE__ */ jsx("span", {
					className: "game-price",
					children: item.price || "Price TBA"
				}),
				item.originalPrice && item.originalPrice !== item.price && /* @__PURE__ */ jsx("span", {
					className: "game-original-price",
					children: item.originalPrice
				}),
				Boolean(item.discount) && /* @__PURE__ */ jsxs("span", {
					className: "game-discount",
					children: [item.discount, "% off"]
				})
			]
		}),
		item.note && /* @__PURE__ */ jsx("span", {
			className: "game-note",
			children: item.note
		}),
		Boolean(item.editions?.length) && /* @__PURE__ */ jsx("span", {
			className: "game-editions",
			children: item.editions?.slice(0, 3).map((edition, index) => /* @__PURE__ */ jsx("span", {
				className: "edition-chip",
				children: editionText(edition)
			}, `${editionText(edition)}-${index}`))
		})
	] });
	return /* @__PURE__ */ jsxs("li", {
		className: `game-item${hasArtwork ? " has-art" : ""}`,
		style: { "--item-index": index },
		children: [hasArtwork && /* @__PURE__ */ jsx(SteamArtwork, {
			item,
			title
		}), /* @__PURE__ */ jsx("div", {
			className: "game-body",
			children: body
		})]
	});
}
function GameList({ items = [], label, pageSize = 6 }) {
	const games = useMemo(() => items.filter(Boolean), [items]);
	const { visible, swapping, start } = useCyclingWindow(games, pageSize);
	return /* @__PURE__ */ jsx("ul", {
		className: `game-list cycle-list react-cycle-list${pageSize === 3 && games.length >= 3 ? " is-triple" : ""}${games.length > pageSize ? " is-cycling" : " is-static-animated"}${swapping ? " is-swapping" : ""}`,
		"aria-label": label,
		children: visible.map((item, index) => /* @__PURE__ */ jsx(GameItem, {
			item,
			index
		}, `${start}-${item.appid || item.title || item.name}-${index}`))
	});
}
//#endregion
//#region _ssr-entry.mjs
var steam = JSON.parse(fs.readFileSync("./data/steam.json", "utf8"));
try {
	const html = renderToStaticMarkup(React.createElement(PlaystyleView, { steam }));
	console.log("PLAYSTYLE RENDER OK, length=", html.length);
	console.log("contains deep-dive button:", /playstyle-habit-card/.test(html));
	console.log("contains Tap to view:", /Tap to view/.test(html));
} catch (e) {
	console.error("PLAYSTYLE RENDER THREW:", e && e.message);
	console.error(e && e.stack);
	process.exit(1);
}
//#endregion
export {};
