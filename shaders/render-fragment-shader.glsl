
precision highp float;

uniform float exposure;
uniform float invGamma;
uniform float saturation;

in vec3 pColor;
out vec4 outColor;


float tonemapReinhard(float x)
{
  return x / (1.0 + x);
}

float tonemapFilmic(float x)
{
  float X = max(0.0, x - 0.004);
  float result = (X * (6.2 * X + 0.5)) / (X * (6.2 * X + 1.7) + 0.06);
  return pow(result, 2.2);
}

vec3 post(in vec3 C)
{
    // apply gamma correction to convert linear RGB to sRGB
    C = pow(C, vec3(invGamma));

    // deal with out-of-gamut RGB.
    float delta = -min(0.0, min(min(C.r, C.g), C.b));
    C.r += delta;
    C.g += delta;
    C.b += delta;

    // apply tonemapping
    C *= pow(2.0, exposure);
    float R = C.r;
    float G = C.g;
    float B = C.b;
    R = tonemapFilmic(R);
    G = tonemapFilmic(G);
    B = tonemapFilmic(B);

    // apply saturation
    float mean = (R + G + B)/3.0;
    float dR = R - mean;
    float dG = G - mean;
    float dB = B - mean;
    R = mean + sign(dR)*pow(abs(dR), 1.0/saturation);
    G = mean + sign(dG)*pow(abs(dG), 1.0/saturation);
    B = mean + sign(dB)*pow(abs(dB), 1.0/saturation);

    return vec3(R,G,B);
}


void main()
{
    vec2 uv = 2.0*gl_PointCoord-1.0;
    float r = length(uv);
    float alpha = smoothstep(1.0, 0.0, r);
    outColor.rgb = post(pColor) * alpha;
    outColor.a = alpha;
}