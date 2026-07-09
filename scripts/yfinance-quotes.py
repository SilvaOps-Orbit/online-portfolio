#!/usr/bin/env python3
"""Fetch compact quote data with yfinance and print JSON for the Node builder."""

from __future__ import annotations

import json
import math
import sys
from datetime import datetime, timezone


def as_float(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def fast_value(info, *keys):
    for key in keys:
        try:
            value = info.get(key)
        except AttributeError:
            try:
                value = info[key]
            except Exception:
                value = None
        except Exception:
            value = None

        if value not in (None, ""):
            return value
    return None


def history_snapshot(ticker):
    try:
        history = ticker.history(period="7d", interval="1d", auto_adjust=False)
    except Exception:
        return None, None, []

    try:
        closes = history["Close"].dropna()
        if closes.empty:
            return None, None, []
        price = as_float(closes.iloc[-1])
        previous_close = as_float(closes.iloc[-2]) if len(closes) > 1 else None
        points = []
        for index, close in closes.tail(7).items():
            close_value = as_float(close)
            if close_value is None:
                continue
            try:
                date_value = index.date().isoformat()
            except Exception:
                date_value = str(index)
            points.append({
                "date": date_value,
                "close": close_value,
            })
        return price, previous_close, points
    except Exception:
        return None, None, []


def quote(symbol):
    import yfinance as yf  # type: ignore[reportMissingImports]

    ticker = yf.Ticker(symbol)
    try:
        fast = ticker.fast_info
    except Exception:
        fast = {}

    price = as_float(fast_value(fast, "last_price", "lastPrice", "regular_market_price"))
    previous_close = as_float(fast_value(fast, "previous_close", "previousClose", "regular_market_previous_close"))

    history_price, history_previous_close, history_points = history_snapshot(ticker)

    if price is None:
        price = history_price
        previous_close = previous_close if previous_close is not None else history_previous_close

    if price is None:
        return None

    change = price - previous_close if previous_close not in (None, 0) else None
    change_percent = (change / previous_close) * 100 if change is not None and previous_close else None
    currency = fast_value(fast, "currency") or "USD"
    exchange = fast_value(fast, "exchange", "exchange_name", "full_exchange_name") or ""

    return {
        "source": "yfinance",
        "price": price,
        "previousClose": previous_close,
        "change": change,
        "changePercent": change_percent,
        "currency": currency,
        "exchange": exchange,
        "history": history_points,
        "updatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }


def main():
    symbols = [symbol for symbol in sys.argv[1:] if symbol]
    results = {}

    for symbol in symbols:
        try:
            item = quote(symbol)
            if item:
                results[symbol] = item
        except Exception as error:
            results[symbol] = {
                "source": "yfinance",
                "error": str(error)[:160],
            }

    print(json.dumps(results, separators=(",", ":")))


if __name__ == "__main__":
    main()
