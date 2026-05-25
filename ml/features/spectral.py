"""CWT scalogram + spectral entropy/RMS/crest features (PyWavelets).

Per-window, per-channel feature extractors for 1D signals. Provides:
- time_stats: RMS, crest, peak-to-peak, abs_mean, std, skew, kurtosis.
- shannon_entropy: histogram-based normalized Shannon entropy.
- cwt_energies: per-band energies from a continuous wavelet transform.
- glcm_haralick_on_scalogram: Haralick texture features on |CWT| scalogram.
- spectral_features: convenience entry point merging all of the above.

Designed to be deterministic; constant / NaN inputs return 0.0-valued
features rather than raising.
"""

from __future__ import annotations

from typing import Dict

import numpy as np
import pandas as pd  # noqa: F401  (re-exported convenience for callers)
import pywt
from scipy import stats
from skimage.feature import graycomatrix, graycoprops

SEED = 20260520


def _sanitize(x: np.ndarray) -> np.ndarray:
    """Coerce input to a 1D float64 array with NaN/inf replaced by 0.0."""
    arr = np.asarray(x, dtype=np.float64).ravel()
    if arr.size == 0:
        return arr
    if not np.all(np.isfinite(arr)):
        arr = np.nan_to_num(arr, nan=0.0, posinf=0.0, neginf=0.0)
    return arr


def _is_degenerate(x: np.ndarray) -> bool:
    """True if signal is empty or effectively constant (zero variance)."""
    if x.size == 0:
        return True
    return float(np.ptp(x)) <= 0.0


def time_stats(x: np.ndarray) -> Dict[str, float]:
    """Return time-domain summary statistics for a 1D signal.

    Keys: rms, crest_factor, peak_to_peak, abs_mean, std, skew, kurtosis.
    Constant / empty signals yield all zeros.
    """
    keys = ["rms", "crest_factor", "peak_to_peak", "abs_mean",
            "std", "skew", "kurtosis"]
    arr = _sanitize(x)
    if arr.size == 0:
        return {k: 0.0 for k in keys}

    rms = float(np.sqrt(np.mean(arr ** 2)))
    peak = float(np.max(np.abs(arr)))
    crest = float(peak / rms) if rms > 1e-12 else 0.0
    ptp = float(np.ptp(arr))
    abs_mean = float(np.mean(np.abs(arr)))
    std = float(np.std(arr))
    if std > 1e-12:
        sk = float(stats.skew(arr, bias=False))
        kt = float(stats.kurtosis(arr, bias=False))
    else:
        sk = 0.0
        kt = 0.0
    return {
        "rms": rms,
        "crest_factor": crest,
        "peak_to_peak": ptp,
        "abs_mean": abs_mean,
        "std": std,
        "skew": sk,
        "kurtosis": kt,
    }


def shannon_entropy(x: np.ndarray, bins: int = 32) -> float:
    """Histogram-based normalized Shannon entropy in [0, 1].

    Uses ``bins`` equal-width bins between min and max of ``x``. Empty
    or constant signals return 0.0. Empty bins are excluded from the
    sum to avoid ``log(0)``.
    """
    arr = _sanitize(x)
    if _is_degenerate(arr) or bins < 2:
        return 0.0
    hist, _ = np.histogram(arr, bins=bins)
    total = hist.sum()
    if total <= 0:
        return 0.0
    p = hist.astype(np.float64) / float(total)
    p = p[p > 0.0]
    if p.size == 0:
        return 0.0
    H = float(-np.sum(p * np.log(p)))
    Hmax = float(np.log(bins))
    return H / Hmax if Hmax > 0.0 else 0.0


def cwt_energies(
    x: np.ndarray,
    scales: np.ndarray = np.arange(1, 33),
    wavelet: str = "morl",
    n_bands: int = 4,
) -> Dict[str, float]:
    """Continuous wavelet transform band energies.

    Computes ``pywt.cwt`` and partitions the scale axis into
    ``n_bands`` contiguous bands. Each band's energy is the mean of
    ``|coef|**2`` over that band. ``cwt_total_energy`` is the mean of
    ``|coef|**2`` over all scales/samples.

    Returns keys ``cwt_band{i}_energy`` for i in [0, n_bands) plus
    ``cwt_total_energy``. Degenerate signals return zeros.
    """
    scales = np.asarray(scales)
    n_bands = max(1, int(n_bands))
    keys = [f"cwt_band{i}_energy" for i in range(n_bands)] + ["cwt_total_energy"]
    out = {k: 0.0 for k in keys}

    arr = _sanitize(x)
    if _is_degenerate(arr) or scales.size == 0:
        return out

    try:
        coef, _ = pywt.cwt(arr, scales, wavelet)
    except Exception:
        return out

    power = np.abs(coef) ** 2
    out["cwt_total_energy"] = float(np.mean(power)) if power.size else 0.0

    n_scales = power.shape[0]
    if n_scales == 0:
        return out
    edges = np.linspace(0, n_scales, n_bands + 1, dtype=int)
    for i in range(n_bands):
        lo, hi = int(edges[i]), int(edges[i + 1])
        if hi <= lo:
            out[f"cwt_band{i}_energy"] = 0.0
            continue
        band = power[lo:hi]
        out[f"cwt_band{i}_energy"] = float(np.mean(band)) if band.size else 0.0
    return out


def glcm_haralick_on_scalogram(
    coef_matrix: np.ndarray,
    levels: int = 16,
) -> Dict[str, float]:
    """Haralick GLCM features on a |CWT| scalogram.

    Min-max scales ``|coef_matrix|`` to integers in ``[0, levels-1]``,
    builds a co-occurrence matrix with ``distances=[1]`` and four
    angles (0, pi/4, pi/2, 3pi/4), then returns the mean over angles
    of contrast, dissimilarity, homogeneity, energy, correlation.

    Returns keys: ``glcm_contrast``, ``glcm_dissimilarity``,
    ``glcm_homogeneity``, ``glcm_energy``, ``glcm_correlation``.
    Degenerate input returns zeros.
    """
    props = ["contrast", "dissimilarity", "homogeneity", "energy", "correlation"]
    out = {f"glcm_{p}": 0.0 for p in props}

    if coef_matrix is None:
        return out
    mat = np.asarray(coef_matrix)
    if mat.ndim != 2 or mat.size == 0:
        return out

    mag = np.abs(mat).astype(np.float64)
    if not np.all(np.isfinite(mag)):
        mag = np.nan_to_num(mag, nan=0.0, posinf=0.0, neginf=0.0)

    mn, mx = float(mag.min()), float(mag.max())
    if not np.isfinite(mn) or not np.isfinite(mx) or mx - mn <= 0.0:
        return out

    levels = max(2, int(levels))
    scaled = (mag - mn) / (mx - mn)
    img = np.clip((scaled * (levels - 1)).round().astype(np.int64),
                  0, levels - 1).astype(np.uint8)

    angles = [0.0, np.pi / 4.0, np.pi / 2.0, 3.0 * np.pi / 4.0]
    try:
        glcm = graycomatrix(
            img,
            distances=[1],
            angles=angles,
            levels=levels,
            symmetric=True,
            normed=True,
        )
    except Exception:
        return out

    for p in props:
        try:
            vals = graycoprops(glcm, p)  # shape (1, n_angles)
            out[f"glcm_{p}"] = float(np.nanmean(vals))
        except Exception:
            out[f"glcm_{p}"] = 0.0
    return out


def spectral_features(x: np.ndarray, **kwargs) -> Dict[str, float]:
    """Compute the full feature dict for a single 1D channel-window.

    Merges :func:`time_stats`, ``{'shannon_entropy': ...}``,
    :func:`cwt_energies`, and :func:`glcm_haralick_on_scalogram` on
    the underlying CWT scalogram. Keyword args are forwarded by name:
    ``bins`` to ``shannon_entropy``; ``scales``, ``wavelet``,
    ``n_bands`` to ``cwt_energies`` / scalogram; ``levels`` to GLCM.
    """
    bins = int(kwargs.get("bins", 32))
    scales = np.asarray(kwargs.get("scales", np.arange(1, 33)))
    wavelet = kwargs.get("wavelet", "morl")
    n_bands = int(kwargs.get("n_bands", 4))
    levels = int(kwargs.get("levels", 16))

    arr = _sanitize(x)
    feats: Dict[str, float] = {}
    feats.update(time_stats(arr))
    feats["shannon_entropy"] = shannon_entropy(arr, bins=bins)
    feats.update(cwt_energies(arr, scales=scales, wavelet=wavelet, n_bands=n_bands))

    coef = None
    if not _is_degenerate(arr) and scales.size > 0:
        try:
            coef, _ = pywt.cwt(arr, scales, wavelet)
        except Exception:
            coef = None
    feats.update(glcm_haralick_on_scalogram(coef, levels=levels))
    return feats
