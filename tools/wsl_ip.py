import re
import subprocess


def _pick_ip(candidates: list[str]) -> str | None:
    for ip in candidates:
        if not ip:
            continue
        if ip.startswith("127."):
            continue
        if ip == "10.255.255.254":
            continue
        return ip
    return None


def main() -> int:
    try:
        output = subprocess.check_output(
            ["ip", "-4", "-o", "addr", "show", "scope", "global"],
            stderr=subprocess.DEVNULL,
        ).decode("utf-8", errors="ignore")
        candidates = re.findall(r"inet (\d+\.\d+\.\d+\.\d+)", output)
        ip = _pick_ip(candidates)
        if ip:
            print(ip)
            return 0
    except Exception:
        pass
    try:
        output = subprocess.check_output(
            ["hostname", "-I"], stderr=subprocess.DEVNULL
        ).decode("utf-8", errors="ignore")
        candidates = output.strip().split()
        ip = _pick_ip(candidates)
        if ip:
            print(ip)
            return 0
    except Exception:
        pass
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
