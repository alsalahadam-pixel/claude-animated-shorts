"""QA metadata for the v2 edit from remotion/edl.json: shots, crossfades and the planned picture jumps (cuts, white-outs,
flashes, the rewind, impact kicks), so short_qa.py only reports unplanned pops. Usage: python make_shots.py -> shots.json"""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
E = json.load(open(os.path.join(HERE, "..", "remotion", "edl.json")))
shots = [{"id": s["id"], "a": s["o0"], "b": s["o1"]} for s in E["segs"]]
xfade = [[s["o0"] - s["xf"] // 2 - 1, s["o0"] + s["xf"] // 2 + 1] for s in E["segs"] if s.get("xf")]
planned = [[s["o0"] - 1, s["o0"] + 1] for s in E["segs"]]
planned += [[a - 1, d + 1] for a, b, c, d in E["whites"]]
planned += [[f - 1, f + 5] for f in E["flashes"]]
planned += [[a - 1, b + 1] for a, b in E["rewind"]]
planned += [[round(k) - 1, round(k) + 8] for k, g in E["kicks"]]
planned += [[t["o0"] - 1, t["o0"] + 8] for t in E["titles"]] + [[E["total"] - 13, E["total"]]]
json.dump({"shots": shots, "xfade": xfade, "planned": planned}, open(os.path.join(HERE, "shots.json"), "w"), indent=0)
print(len(shots), "shots,", len(planned), "planned jumps")
