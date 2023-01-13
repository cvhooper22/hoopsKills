import React from 'react';

export default function YBall ({width, height, lineColor, fillColor, classname}) {
  return (
    <svg
      id="svg"
      version="1.1"
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      width={width ?? 400}
      height={height ?? 500}
      viewBox="0, 0, 400,500.55555555555554"
      className={classname ?? "y-ball"}
    >
      <g id="svgg">
        <path id="outline" 
          d="M177.435 0.300 C 177.271 0.465,175.306 0.899,173.068 1.264 C 168.433 2.021,165.362 2.689,164.200 3.195 C 163.760 3.386,162.410 3.748,161.200 4.000 C 159.990 4.252,158.640 4.616,158.200 4.810 C 157.760 5.004,156.770 5.340,156.000 5.557 C 154.178 6.070,151.214 7.118,150.200 7.608 C 149.760 7.821,148.594 8.272,147.608 8.612 C 146.623 8.951,145.217 9.583,144.485 10.015 C 143.753 10.447,142.965 10.800,142.734 10.800 C 142.097 10.800,132.434 15.629,130.542 16.893 C 129.630 17.502,128.747 18.000,128.580 18.000 C 128.412 18.000,127.686 18.450,126.964 19.000 C 126.243 19.550,125.528 20.000,125.374 20.000 C 125.221 20.000,124.219 20.630,123.147 21.400 C 122.075 22.170,121.094 22.800,120.966 22.800 C 120.839 22.800,119.966 23.430,119.026 24.200 C 118.086 24.970,117.220 25.600,117.100 25.600 C 116.863 25.600,116.174 26.162,111.517 30.156 C 109.821 31.610,108.289 32.800,108.112 32.800 C 107.614 32.800,95.200 45.352,95.200 45.856 C 95.200 46.101,94.901 46.549,94.535 46.851 C 94.169 47.153,92.864 48.588,91.635 50.040 C 88.509 53.734,88.000 54.377,88.000 54.637 C 88.000 54.763,87.370 55.634,86.600 56.574 C 85.830 57.514,85.200 58.407,85.200 58.558 C 85.200 58.710,84.501 59.772,83.647 60.917 C 82.792 62.063,81.790 63.540,81.419 64.200 C 81.048 64.860,80.318 66.120,79.796 67.000 C 79.275 67.880,78.302 69.631,77.634 70.891 C 76.967 72.152,75.966 73.903,75.410 74.783 C 74.855 75.664,74.400 76.571,74.400 76.800 C 74.400 77.153,73.118 80.049,70.594 85.400 C 70.282 86.060,69.903 87.140,69.751 87.800 C 69.598 88.460,69.250 89.360,68.976 89.800 C 68.702 90.240,68.354 91.197,68.202 91.927 C 68.049 92.657,67.673 93.737,67.365 94.327 C 67.057 94.917,66.804 95.814,66.802 96.320 C 66.801 96.826,66.547 97.728,66.239 98.325 C 65.930 98.922,65.547 100.308,65.388 101.405 C 65.229 102.502,64.963 103.580,64.796 103.800 C 64.629 104.020,64.275 105.550,64.007 107.200 C 63.740 108.850,63.368 110.560,63.181 111.000 C 62.866 111.739,62.578 113.454,61.605 120.400 C 61.405 121.830,61.229 124.260,61.215 125.800 C 61.201 127.340,61.081 129.005,60.948 129.500 L 60.707 130.400 30.353 130.400 L 0.000 130.400 0.000 181.600 L 0.000 232.800 17.841 232.800 L 35.682 232.800 40.941 237.700 C 43.834 240.395,46.260 242.735,46.333 242.900 C 46.407 243.065,46.650 243.200,46.875 243.200 C 47.100 243.200,49.759 245.540,52.785 248.400 C 55.811 251.260,58.423 253.600,58.590 253.600 C 58.757 253.600,60.161 254.860,61.711 256.400 C 63.260 257.940,64.609 259.200,64.708 259.200 C 64.808 259.200,67.276 261.450,70.192 264.200 C 73.109 266.950,75.629 269.200,75.793 269.200 C 75.956 269.200,78.656 271.630,81.793 274.600 C 84.929 277.570,87.621 280.000,87.775 280.000 C 87.929 280.000,89.167 281.070,90.527 282.378 C 91.887 283.685,94.750 286.340,96.889 288.278 L 100.777 291.800 100.789 340.500 L 100.800 389.200 77.833 389.200 C 65.201 389.200,54.581 389.309,54.233 389.443 C 53.660 389.663,53.600 394.933,53.600 445.043 L 53.600 500.400 199.800 500.400 L 346.000 500.400 346.000 445.043 C 346.000 394.933,345.940 389.663,345.367 389.443 C 345.019 389.309,334.579 389.200,322.167 389.200 L 299.600 389.200 299.600 340.300 L 299.600 291.400 303.970 287.300 C 306.373 285.045,308.462 283.200,308.611 283.200 C 308.761 283.200,309.989 282.151,311.342 280.869 C 318.748 273.846,325.556 267.600,325.802 267.600 C 325.957 267.600,328.559 265.260,331.585 262.400 C 334.611 259.540,337.242 257.200,337.431 257.200 C 337.621 257.200,338.861 256.127,340.188 254.816 C 344.159 250.891,354.282 241.600,354.587 241.600 C 354.743 241.600,356.970 239.621,359.535 237.203 L 364.200 232.805 382.100 232.803 L 400.000 232.800 400.000 181.600 L 400.000 130.400 369.456 130.400 L 338.913 130.400 338.625 125.103 C 338.466 122.190,338.194 119.625,338.019 119.403 C 337.844 119.181,337.580 117.560,337.431 115.800 C 337.283 114.040,336.977 111.880,336.752 111.000 C 336.527 110.120,336.173 108.410,335.965 107.200 C 335.758 105.990,335.421 104.640,335.215 104.200 C 335.010 103.760,334.633 102.320,334.377 101.000 C 334.122 99.680,333.773 98.420,333.602 98.200 C 333.431 97.980,333.164 97.036,333.010 96.102 C 332.856 95.168,332.586 94.315,332.411 94.207 C 332.235 94.098,331.967 93.332,331.816 92.504 C 331.665 91.677,331.313 90.640,331.034 90.200 C 330.755 89.760,330.402 88.860,330.249 88.200 C 330.097 87.540,329.709 86.415,329.386 85.700 C 329.064 84.985,328.541 83.815,328.225 83.100 C 327.909 82.385,327.189 80.760,326.625 79.488 C 326.061 78.217,325.600 77.017,325.600 76.821 C 325.600 76.626,325.465 76.407,325.300 76.333 C 325.135 76.260,324.408 75.030,323.684 73.600 C 321.484 69.253,320.261 67.074,318.900 65.072 C 318.185 64.020,317.600 63.067,317.600 62.953 C 317.600 62.840,317.150 62.157,316.600 61.436 C 316.050 60.714,315.600 59.916,315.600 59.662 C 315.600 59.408,315.414 59.200,315.187 59.200 C 314.961 59.200,314.663 58.885,314.526 58.500 C 314.388 58.115,313.674 57.050,312.938 56.133 C 312.202 55.216,311.600 54.356,311.600 54.222 C 311.600 53.842,305.531 46.738,304.300 45.677 C 303.695 45.156,303.200 44.517,303.200 44.258 C 303.200 43.660,293.941 34.400,293.343 34.400 C 293.098 34.400,292.651 34.099,292.349 33.731 C 291.469 32.659,283.846 26.330,281.592 24.800 C 280.458 24.030,279.288 23.175,278.993 22.900 C 278.698 22.625,278.335 22.400,278.186 22.400 C 278.037 22.400,277.259 21.905,276.456 21.300 C 274.471 19.804,273.594 19.254,272.300 18.698 C 271.695 18.438,271.200 18.101,271.200 17.950 C 271.200 17.799,270.075 17.114,268.700 16.429 C 267.325 15.743,264.504 14.286,262.431 13.191 C 260.358 12.096,258.488 11.200,258.275 11.200 C 258.062 11.200,257.148 10.854,256.244 10.432 C 255.340 10.009,253.700 9.273,252.600 8.796 C 251.500 8.319,250.240 7.772,249.800 7.581 C 249.360 7.390,248.243 7.041,247.317 6.806 C 246.391 6.571,245.535 6.219,245.415 6.024 C 245.294 5.829,244.432 5.544,243.498 5.390 C 242.564 5.236,241.620 4.973,241.400 4.807 C 241.180 4.641,240.010 4.288,238.800 4.024 C 237.590 3.759,236.240 3.386,235.800 3.195 C 234.650 2.694,231.566 2.025,227.200 1.329 C 225.110 0.996,223.087 0.560,222.705 0.362 C 221.871 -0.073,177.865 -0.133,177.435 0.300 M194.100 12.264 C 194.662 12.607,194.463 98.254,193.900 98.683 C 193.095 99.296,181.790 97.873,177.687 96.641 C 176.649 96.330,174.360 95.683,172.600 95.204 C 170.840 94.725,168.860 94.092,168.200 93.797 C 167.540 93.502,166.280 92.996,165.400 92.671 C 160.174 90.741,155.662 88.488,151.916 85.938 C 151.320 85.532,150.673 85.200,150.479 85.200 C 150.285 85.200,148.792 84.231,147.163 83.046 C 133.699 73.257,123.525 61.739,117.131 49.047 C 114.844 44.507,114.841 43.694,117.108 42.248 C 117.928 41.724,119.036 40.824,119.570 40.248 C 120.103 39.672,120.714 39.200,120.928 39.200 C 121.141 39.200,121.695 38.823,122.158 38.362 C 122.621 37.902,124.080 36.732,125.400 35.764 C 126.720 34.796,127.980 33.863,128.200 33.692 C 128.738 33.272,133.110 30.538,136.800 28.313 C 146.507 22.461,160.354 17.130,173.600 14.144 C 175.030 13.821,176.830 13.483,177.600 13.391 C 184.380 12.584,186.362 12.303,187.400 11.998 C 188.526 11.667,193.441 11.863,194.100 12.264 M216.000 12.398 C 218.310 12.645,220.470 12.960,220.800 13.098 C 221.337 13.322,225.729 14.214,227.800 14.519 C 230.462 14.911,241.159 18.209,246.200 20.193 C 258.752 25.131,270.844 32.274,280.074 40.200 C 281.611 41.520,283.312 42.870,283.854 43.200 C 285.053 43.930,284.893 45.657,283.391 48.200 C 282.871 49.080,281.980 50.660,281.410 51.712 C 280.841 52.763,279.425 55.013,278.263 56.712 C 277.102 58.410,275.660 60.520,275.059 61.400 C 271.289 66.917,258.846 79.474,256.270 80.362 C 256.012 80.451,255.080 81.100,254.200 81.804 C 245.878 88.459,230.859 95.029,218.400 97.462 C 214.055 98.310,213.371 98.402,209.500 98.654 L 206.000 98.882 206.000 55.465 L 206.000 12.048 207.500 11.875 C 209.126 11.688,209.694 11.723,216.000 12.398 M107.179 54.100 C 107.494 54.595,108.171 55.810,108.683 56.800 C 110.235 59.799,113.192 64.500,114.637 66.267 C 115.386 67.184,116.000 68.064,116.000 68.223 C 116.000 68.382,116.990 69.639,118.200 71.017 C 119.410 72.395,120.400 73.632,120.400 73.765 C 120.400 74.528,136.085 89.157,137.325 89.551 C 137.586 89.634,138.160 90.013,138.600 90.392 C 143.122 94.295,159.856 103.259,164.398 104.213 C 165.168 104.375,166.338 104.732,166.998 105.006 C 168.918 105.804,172.067 106.743,173.800 107.035 C 174.680 107.183,175.580 107.436,175.800 107.598 C 176.020 107.759,176.470 107.899,176.800 107.908 C 177.130 107.918,178.300 108.126,179.400 108.370 C 182.641 109.090,186.028 109.547,190.487 109.865 C 194.659 110.164,194.430 109.458,194.307 121.649 L 194.200 132.200 134.243 132.301 C 71.013 132.408,72.845 132.459,73.392 130.628 C 73.612 129.891,74.158 125.508,74.592 121.000 C 74.919 117.602,77.057 106.492,77.559 105.587 C 77.745 105.250,78.022 104.350,78.172 103.587 C 78.323 102.824,78.595 101.840,78.776 101.400 C 78.958 100.960,79.587 99.070,80.174 97.200 C 80.761 95.330,81.408 93.440,81.610 93.000 C 81.812 92.560,82.350 91.229,82.806 90.042 C 83.941 87.085,89.115 76.784,91.141 73.450 C 92.053 71.947,92.800 70.628,92.800 70.517 C 92.800 70.406,93.340 69.633,94.000 68.800 C 94.660 67.967,95.200 67.155,95.200 66.996 C 95.200 66.837,96.058 65.603,97.107 64.254 C 98.156 62.904,99.305 61.350,99.661 60.800 C 100.261 59.873,103.283 56.192,105.163 54.100 C 105.608 53.605,106.115 53.200,106.289 53.200 C 106.464 53.200,106.865 53.605,107.179 54.100 M295.957 55.800 C 297.113 57.120,298.415 58.650,298.849 59.200 C 301.734 62.856,303.279 64.966,305.001 67.600 C 306.079 69.250,307.093 70.694,307.255 70.808 C 307.417 70.923,307.746 71.463,307.987 72.008 C 308.227 72.554,309.141 74.170,310.019 75.600 C 312.033 78.880,315.200 85.168,315.200 85.885 C 315.200 86.184,315.457 86.827,315.771 87.314 C 316.875 89.026,320.815 100.028,321.963 104.600 C 322.183 105.480,322.659 107.280,323.019 108.600 C 323.781 111.393,323.872 111.868,324.516 116.400 C 324.782 118.270,325.138 120.012,325.306 120.271 C 325.474 120.531,325.607 121.521,325.601 122.471 C 325.595 123.422,325.699 126.046,325.832 128.301 L 326.075 132.403 266.138 132.301 L 206.200 132.200 206.200 121.200 L 206.200 110.200 208.400 110.104 C 209.610 110.052,211.860 109.822,213.400 109.594 C 214.940 109.366,216.740 109.100,217.400 109.004 C 220.349 108.572,223.357 107.945,223.952 107.639 C 224.308 107.455,225.320 107.181,226.200 107.029 C 227.704 106.769,232.023 105.504,233.800 104.803 C 234.240 104.630,236.040 103.937,237.800 103.265 C 242.766 101.367,251.764 97.025,253.200 95.833 C 253.530 95.559,254.700 94.825,255.800 94.200 C 256.900 93.576,258.610 92.463,259.600 91.728 C 260.590 90.992,261.760 90.123,262.200 89.796 C 264.249 88.273,267.855 85.265,268.349 84.666 C 268.651 84.300,269.104 84.000,269.356 84.000 C 269.843 84.000,277.067 76.791,278.030 75.344 C 278.344 74.873,279.680 73.219,281.000 71.669 C 283.818 68.359,286.625 64.569,288.244 61.885 C 290.418 58.281,291.001 57.295,292.169 55.238 C 293.547 52.813,293.307 52.777,295.957 55.800 M62.256 143.690 C 62.422 143.960,62.593 145.556,62.636 147.237 C 62.678 148.918,62.845 150.894,63.006 151.628 C 63.167 152.362,63.357 153.781,63.427 154.782 C 63.697 158.653,64.644 164.292,65.746 168.600 C 66.083 169.920,66.652 172.169,67.011 173.599 C 69.495 183.515,75.979 198.899,81.511 208.000 C 84.410 212.769,87.641 217.619,88.815 218.962 C 89.410 219.643,90.382 220.920,90.974 221.800 C 94.405 226.896,107.196 239.993,113.600 244.966 C 114.590 245.735,115.758 246.687,116.196 247.082 C 116.633 247.477,117.638 248.250,118.429 248.800 C 133.896 259.557,143.639 264.318,162.800 270.482 C 165.566 271.372,175.693 273.531,178.600 273.850 C 179.480 273.947,181.460 274.213,183.000 274.442 C 187.198 275.066,192.202 275.321,200.200 275.319 C 208.838 275.316,216.607 274.799,220.600 273.962 C 221.700 273.732,223.230 273.476,224.000 273.393 C 226.321 273.143,233.772 271.372,238.200 270.017 C 239.740 269.546,241.540 268.999,242.200 268.803 C 244.159 268.219,249.337 266.436,250.200 266.049 C 250.640 265.851,252.170 265.199,253.600 264.599 C 262.453 260.887,275.188 253.608,281.041 248.916 C 281.944 248.192,282.838 247.600,283.027 247.600 C 283.217 247.600,283.738 247.243,284.186 246.806 C 284.634 246.369,285.900 245.288,287.000 244.404 C 293.801 238.939,303.519 228.969,308.506 222.339 C 308.895 221.822,309.988 220.410,310.936 219.200 C 311.884 217.990,313.524 215.650,314.579 214.000 C 315.635 212.350,316.791 210.550,317.148 210.000 C 317.505 209.450,318.033 208.550,318.321 208.000 C 318.608 207.450,319.372 206.100,320.016 205.000 C 321.290 202.828,324.594 196.255,325.669 193.756 C 326.038 192.900,326.797 191.188,327.357 189.951 C 329.414 185.407,333.807 171.158,334.618 166.400 C 335.313 162.315,335.933 158.968,336.025 158.800 C 336.084 158.690,336.186 157.880,336.251 157.000 C 336.316 156.120,336.568 154.050,336.812 152.400 C 337.055 150.750,337.236 148.212,337.213 146.761 C 337.153 142.884,334.927 143.180,363.245 143.297 L 388.200 143.400 388.200 181.400 L 388.200 219.400 373.774 219.600 L 359.349 219.800 357.374 221.468 C 356.288 222.385,354.507 224.050,353.415 225.168 C 352.323 226.285,351.216 227.200,350.955 227.200 C 350.693 227.200,349.544 228.280,348.400 229.600 C 347.256 230.920,346.127 232.000,345.889 232.000 C 345.652 232.000,344.005 233.360,342.229 235.023 C 338.852 238.184,336.092 240.714,331.400 244.949 C 329.860 246.338,327.236 248.764,325.570 250.338 C 323.903 251.912,322.373 253.199,322.170 253.198 C 321.966 253.197,320.720 254.290,319.400 255.627 C 318.080 256.964,315.470 259.402,313.600 261.043 C 310.338 263.907,308.129 265.921,302.021 271.600 C 300.483 273.030,297.854 275.370,296.180 276.800 C 294.506 278.230,291.935 280.616,290.468 282.103 C 289.001 283.590,287.594 284.805,287.343 284.803 C 287.091 284.801,286.776 285.085,286.643 285.433 C 286.138 286.749,286.371 401.411,286.880 401.920 C 287.242 402.282,292.987 402.400,310.282 402.400 L 333.204 402.400 333.102 445.500 L 333.000 488.600 200.042 488.701 C 101.824 488.775,66.941 488.683,66.540 488.350 C 66.087 487.974,66.013 480.794,66.098 445.250 L 66.200 402.600 89.800 402.392 C 102.780 402.278,113.445 402.143,113.500 402.092 C 113.555 402.041,113.600 375.897,113.600 343.992 L 113.600 285.985 111.522 283.792 C 110.379 282.587,109.285 281.600,109.090 281.600 C 108.776 281.600,101.842 275.383,94.400 268.429 C 92.970 267.093,90.270 264.656,88.400 263.013 C 86.530 261.371,83.920 259.032,82.600 257.817 C 81.280 256.602,78.850 254.365,77.200 252.846 C 75.550 251.326,72.926 248.895,71.368 247.442 C 69.810 245.989,68.353 244.800,68.130 244.800 C 67.907 244.800,66.539 243.585,65.090 242.100 C 63.641 240.615,61.088 238.230,59.416 236.800 C 57.744 235.370,55.120 233.030,53.584 231.600 C 52.049 230.170,49.579 227.890,48.096 226.533 C 46.613 225.177,44.304 223.062,42.964 221.833 L 40.528 219.600 26.264 219.600 L 12.000 219.600 12.000 181.667 C 12.000 160.803,12.120 143.613,12.267 143.467 C 12.795 142.938,61.927 143.158,62.256 143.690 M194.200 154.174 L 194.200 164.948 192.357 165.418 C 191.344 165.676,188.824 166.020,186.758 166.182 C 184.692 166.343,182.821 166.594,182.601 166.738 C 182.380 166.882,181.030 167.211,179.600 167.468 C 174.378 168.408,172.645 168.877,165.136 171.387 C 153.494 175.279,140.373 182.937,131.200 191.196 C 125.683 196.162,123.200 198.587,123.200 199.008 C 123.200 199.268,122.345 200.301,121.300 201.302 C 118.882 203.621,113.243 210.967,111.554 214.000 C 111.126 214.770,110.149 216.390,109.385 217.600 C 108.621 218.810,107.735 220.385,107.418 221.100 C 107.101 221.815,106.607 222.387,106.320 222.370 C 105.718 222.336,100.000 215.912,100.000 215.270 C 100.000 215.033,99.771 214.696,99.490 214.520 C 99.210 214.344,98.674 213.750,98.299 213.200 C 97.923 212.650,96.538 210.670,95.221 208.800 C 91.918 204.114,85.825 193.243,84.234 189.200 C 83.931 188.430,82.931 185.910,82.013 183.600 C 79.278 176.716,77.169 169.753,76.199 164.400 C 76.100 163.850,75.728 161.870,75.373 160.000 C 75.018 158.130,74.658 155.880,74.573 155.000 C 73.876 147.784,73.607 145.534,73.401 145.201 C 73.270 144.990,73.358 144.452,73.596 144.007 C 74.029 143.199,74.151 143.198,134.115 143.299 L 194.200 143.400 194.200 154.174 M325.820 143.580 C 326.536 144.295,325.057 159.026,323.809 163.600 C 323.659 164.150,323.296 165.680,323.003 167.000 C 321.345 174.465,319.925 178.897,316.861 186.167 C 316.089 187.998,310.402 199.457,309.095 201.815 C 308.065 203.673,303.098 211.221,301.734 213.000 C 300.351 214.804,299.361 216.027,297.807 217.848 C 297.033 218.755,296.400 219.655,296.400 219.848 C 296.400 220.284,293.788 222.400,293.251 222.400 C 293.035 222.400,292.425 221.455,291.896 220.300 C 290.699 217.689,287.146 211.954,285.349 209.733 C 284.607 208.816,284.000 207.922,284.000 207.747 C 284.000 207.572,283.648 207.062,283.217 206.614 C 281.737 205.074,279.600 202.503,279.600 202.260 C 279.600 201.886,268.527 191.119,265.600 188.647 C 259.405 183.416,251.743 178.745,242.200 174.382 C 238.027 172.475,237.031 172.069,235.800 171.776 C 235.140 171.618,234.420 171.352,234.200 171.184 C 233.980 171.016,232.990 170.673,232.000 170.422 C 231.010 170.172,229.840 169.809,229.400 169.617 C 227.454 168.768,218.070 166.734,215.734 166.656 C 214.818 166.625,213.933 166.465,213.767 166.300 C 213.602 166.135,212.599 166.000,211.539 166.000 C 210.479 166.000,208.805 165.784,207.818 165.520 L 206.025 165.041 205.912 154.420 C 205.851 148.579,205.856 143.665,205.924 143.500 C 206.111 143.046,325.365 143.125,325.820 143.580 M193.634 176.800 C 194.389 176.800,194.402 177.618,194.302 220.500 L 194.200 264.200 192.400 264.108 C 188.346 263.900,184.867 263.574,182.600 263.187 C 181.280 262.962,179.660 262.712,179.000 262.630 C 178.340 262.549,176.450 262.182,174.800 261.816 C 173.150 261.449,171.440 261.095,171.000 261.029 C 167.796 260.545,155.077 256.461,151.000 254.608 C 146.794 252.695,138.198 248.355,136.003 247.036 C 130.613 243.796,123.961 239.254,123.466 238.474 C 123.282 238.185,122.799 237.825,122.391 237.674 C 121.984 237.524,120.200 236.083,118.426 234.473 C 114.766 231.152,114.652 230.784,116.370 227.800 C 117.003 226.700,118.275 224.450,119.197 222.801 C 120.119 221.151,120.992 219.711,121.137 219.601 C 121.282 219.490,122.437 217.855,123.704 215.966 C 124.972 214.077,126.457 212.110,127.004 211.596 C 127.552 211.081,128.000 210.500,128.000 210.303 C 128.000 209.991,129.507 208.365,133.722 204.128 C 137.853 199.975,144.720 194.000,145.361 194.000 C 145.491 194.000,146.662 193.216,147.963 192.259 C 153.454 188.217,168.136 181.586,176.012 179.591 C 181.433 178.218,183.277 177.869,188.309 177.265 C 189.908 177.073,191.339 176.794,191.488 176.646 C 191.636 176.497,192.007 176.471,192.312 176.588 C 192.616 176.704,193.212 176.800,193.634 176.800 M211.600 177.235 C 213.030 177.427,215.550 177.859,217.200 178.195 C 218.850 178.531,220.650 178.873,221.200 178.956 C 230.775 180.402,248.309 188.917,258.308 196.978 C 262.756 200.564,273.600 211.747,273.600 212.749 C 273.600 212.997,273.764 213.200,273.964 213.200 C 274.255 213.200,277.908 218.516,280.698 223.000 C 281.600 224.451,284.800 230.777,284.800 231.111 C 284.800 231.531,282.755 233.516,280.200 235.578 C 279.100 236.465,277.750 237.558,277.200 238.005 C 274.437 240.254,272.076 241.901,266.000 245.820 C 263.585 247.378,260.259 249.161,255.200 251.611 C 249.571 254.336,249.042 254.571,245.800 255.790 C 244.260 256.369,242.640 256.994,242.200 257.181 C 238.320 258.823,224.722 262.270,221.000 262.555 C 220.340 262.606,219.530 262.760,219.200 262.898 C 218.433 263.219,215.663 263.584,212.600 263.767 C 211.280 263.845,209.255 264.043,208.100 264.206 L 206.000 264.502 206.000 220.679 L 206.000 176.856 206.900 176.684 C 207.395 176.590,208.070 176.596,208.400 176.699 C 208.730 176.801,210.170 177.042,211.600 177.235 "
          stroke="none"
          fill={lineColor ?? "#003fa2"}
          fillRule="evenodd"
        />
        <path id="fillArea"
          d="M187.400 11.998 C 186.362 12.303,184.380 12.584,177.600 13.391 C 167.345 14.611,147.473 21.879,136.800 28.313 C 133.110 30.538,128.738 33.272,128.200 33.692 C 127.980 33.863,126.720 34.796,125.400 35.764 C 124.080 36.732,122.621 37.902,122.158 38.362 C 121.695 38.823,121.141 39.200,120.928 39.200 C 120.714 39.200,120.103 39.672,119.570 40.248 C 119.036 40.824,117.928 41.724,117.108 42.248 C 114.841 43.694,114.844 44.507,117.131 49.047 C 123.525 61.739,133.699 73.257,147.163 83.046 C 148.792 84.231,150.285 85.200,150.479 85.200 C 150.673 85.200,151.320 85.532,151.916 85.938 C 155.662 88.488,160.174 90.741,165.400 92.671 C 166.280 92.996,167.540 93.502,168.200 93.797 C 168.860 94.092,170.840 94.725,172.600 95.204 C 174.360 95.683,176.649 96.330,177.687 96.641 C 181.790 97.873,193.095 99.296,193.900 98.683 C 194.463 98.254,194.662 12.607,194.100 12.264 C 193.441 11.863,188.526 11.667,187.400 11.998 M207.500 11.875 L 206.000 12.048 206.000 55.465 L 206.000 98.882 209.500 98.654 C 224.106 97.702,243.429 90.418,254.200 81.804 C 255.080 81.100,256.012 80.451,256.270 80.362 C 258.846 79.474,271.289 66.917,275.059 61.400 C 275.660 60.520,277.102 58.410,278.263 56.712 C 279.425 55.013,280.841 52.763,281.410 51.712 C 281.980 50.660,282.871 49.080,283.391 48.200 C 284.893 45.657,285.053 43.930,283.854 43.200 C 283.312 42.870,281.611 41.520,280.074 40.200 C 270.844 32.274,258.752 25.131,246.200 20.193 C 241.159 18.209,230.462 14.911,227.800 14.519 C 225.729 14.214,221.337 13.322,220.800 13.098 C 220.470 12.960,218.310 12.645,216.000 12.398 C 209.694 11.723,209.126 11.688,207.500 11.875 M105.163 54.100 C 103.283 56.192,100.261 59.873,99.661 60.800 C 99.305 61.350,98.156 62.904,97.107 64.254 C 96.058 65.603,95.200 66.837,95.200 66.996 C 95.200 67.155,94.660 67.967,94.000 68.800 C 93.340 69.633,92.800 70.406,92.800 70.517 C 92.800 70.628,92.053 71.947,91.141 73.450 C 89.115 76.784,83.941 87.085,82.806 90.042 C 82.350 91.229,81.812 92.560,81.610 93.000 C 81.408 93.440,80.761 95.330,80.174 97.200 C 79.587 99.070,78.958 100.960,78.776 101.400 C 78.595 101.840,78.323 102.824,78.172 103.587 C 78.022 104.350,77.745 105.250,77.559 105.587 C 77.057 106.492,74.919 117.602,74.592 121.000 C 74.158 125.508,73.612 129.891,73.392 130.628 C 72.845 132.459,71.013 132.408,134.243 132.301 L 194.200 132.200 194.307 121.649 C 194.430 109.458,194.659 110.164,190.487 109.865 C 186.028 109.547,182.641 109.090,179.400 108.370 C 178.300 108.126,177.130 107.918,176.800 107.908 C 176.470 107.899,176.020 107.759,175.800 107.598 C 175.580 107.436,174.680 107.183,173.800 107.035 C 172.067 106.743,168.918 105.804,166.998 105.006 C 166.338 104.732,165.168 104.375,164.398 104.213 C 159.856 103.259,143.122 94.295,138.600 90.392 C 138.160 90.013,137.586 89.634,137.325 89.551 C 136.085 89.157,120.400 74.528,120.400 73.765 C 120.400 73.632,119.410 72.395,118.200 71.017 C 116.990 69.639,116.000 68.382,116.000 68.223 C 116.000 68.064,115.386 67.184,114.637 66.267 C 113.192 64.500,110.235 59.799,108.683 56.800 C 107.380 54.283,106.660 53.200,106.289 53.200 C 106.115 53.200,105.608 53.605,105.163 54.100 M292.169 55.238 C 291.001 57.295,290.418 58.281,288.244 61.885 C 286.625 64.569,283.818 68.359,281.000 71.669 C 279.680 73.219,278.344 74.873,278.030 75.344 C 277.067 76.791,269.843 84.000,269.356 84.000 C 269.104 84.000,268.651 84.300,268.349 84.666 C 267.855 85.265,264.249 88.273,262.200 89.796 C 261.760 90.123,260.590 90.992,259.600 91.728 C 258.610 92.463,256.900 93.576,255.800 94.200 C 254.700 94.825,253.530 95.559,253.200 95.833 C 251.764 97.025,242.766 101.367,237.800 103.265 C 236.040 103.937,234.240 104.630,233.800 104.803 C 232.023 105.504,227.704 106.769,226.200 107.029 C 225.320 107.181,224.308 107.455,223.952 107.639 C 223.357 107.945,220.349 108.572,217.400 109.004 C 216.740 109.100,214.940 109.366,213.400 109.594 C 211.860 109.822,209.610 110.052,208.400 110.104 L 206.200 110.200 206.200 121.200 L 206.200 132.200 266.138 132.301 L 326.075 132.403 325.832 128.301 C 325.699 126.046,325.595 123.422,325.601 122.471 C 325.607 121.521,325.474 120.531,325.306 120.271 C 325.138 120.012,324.782 118.270,324.516 116.400 C 323.872 111.868,323.781 111.393,323.019 108.600 C 322.659 107.280,322.183 105.480,321.963 104.600 C 320.815 100.028,316.875 89.026,315.771 87.314 C 315.457 86.827,315.200 86.184,315.200 85.885 C 315.200 85.168,312.033 78.880,310.019 75.600 C 309.141 74.170,308.227 72.554,307.987 72.008 C 307.746 71.463,307.417 70.923,307.255 70.808 C 307.093 70.694,306.079 69.250,305.001 67.600 C 303.279 64.966,301.734 62.856,298.849 59.200 C 297.513 57.507,293.868 53.406,293.596 53.290 C 293.454 53.229,292.812 54.106,292.169 55.238 M12.267 143.467 C 12.120 143.613,12.000 160.803,12.000 181.667 L 12.000 219.600 26.264 219.600 L 40.528 219.600 42.964 221.833 C 44.304 223.062,46.613 225.177,48.096 226.533 C 49.579 227.890,52.049 230.170,53.584 231.600 C 55.120 233.030,57.744 235.370,59.416 236.800 C 61.088 238.230,63.641 240.615,65.090 242.100 C 66.539 243.585,67.907 244.800,68.130 244.800 C 68.353 244.800,69.810 245.989,71.368 247.442 C 72.926 248.895,75.550 251.326,77.200 252.846 C 78.850 254.365,81.280 256.602,82.600 257.817 C 83.920 259.032,86.530 261.371,88.400 263.013 C 90.270 264.656,92.970 267.093,94.400 268.429 C 101.842 275.383,108.776 281.600,109.090 281.600 C 109.285 281.600,110.379 282.587,111.522 283.792 L 113.600 285.985 113.600 343.992 C 113.600 375.897,113.555 402.041,113.500 402.092 C 113.445 402.143,102.780 402.278,89.800 402.392 L 66.200 402.600 66.098 445.250 C 66.013 480.794,66.087 487.974,66.540 488.350 C 66.941 488.683,101.824 488.775,200.042 488.701 L 333.000 488.600 333.102 445.500 L 333.204 402.400 310.282 402.400 C 292.987 402.400,287.242 402.282,286.880 401.920 C 286.371 401.411,286.138 286.749,286.643 285.433 C 286.776 285.085,287.091 284.801,287.343 284.803 C 287.594 284.805,289.001 283.590,290.468 282.103 C 291.935 280.616,294.506 278.230,296.180 276.800 C 297.854 275.370,300.483 273.030,302.021 271.600 C 308.129 265.921,310.338 263.907,313.600 261.043 C 315.470 259.402,318.080 256.964,319.400 255.627 C 320.720 254.290,321.966 253.197,322.170 253.198 C 322.373 253.199,323.903 251.912,325.570 250.338 C 327.236 248.764,329.860 246.338,331.400 244.949 C 336.092 240.714,338.852 238.184,342.229 235.023 C 344.005 233.360,345.652 232.000,345.889 232.000 C 346.127 232.000,347.256 230.920,348.400 229.600 C 349.544 228.280,350.693 227.200,350.955 227.200 C 351.216 227.200,352.323 226.285,353.415 225.168 C 354.507 224.050,356.288 222.385,357.374 221.468 L 359.349 219.800 373.774 219.600 L 388.200 219.400 388.200 181.400 L 388.200 143.400 363.245 143.297 C 334.927 143.180,337.153 142.884,337.213 146.761 C 337.236 148.212,337.055 150.750,336.812 152.400 C 336.568 154.050,336.316 156.120,336.251 157.000 C 336.186 157.880,336.084 158.690,336.025 158.800 C 335.933 158.968,335.313 162.315,334.618 166.400 C 333.807 171.158,329.414 185.407,327.357 189.951 C 326.797 191.188,326.038 192.900,325.669 193.756 C 324.594 196.255,321.290 202.828,320.016 205.000 C 319.372 206.100,318.608 207.450,318.321 208.000 C 318.033 208.550,317.505 209.450,317.148 210.000 C 316.791 210.550,315.635 212.350,314.579 214.000 C 313.524 215.650,311.884 217.990,310.936 219.200 C 309.988 220.410,308.895 221.822,308.506 222.339 C 303.519 228.969,293.801 238.939,287.000 244.404 C 285.900 245.288,284.634 246.369,284.186 246.806 C 283.738 247.243,283.217 247.600,283.027 247.600 C 282.838 247.600,281.944 248.192,281.041 248.916 C 275.188 253.608,262.453 260.887,253.600 264.599 C 252.170 265.199,250.640 265.851,250.200 266.049 C 249.337 266.436,244.159 268.219,242.200 268.803 C 241.540 268.999,239.740 269.546,238.200 270.017 C 233.772 271.372,226.321 273.143,224.000 273.393 C 223.230 273.476,221.700 273.732,220.600 273.962 C 216.607 274.799,208.838 275.316,200.200 275.319 C 192.202 275.321,187.198 275.066,183.000 274.442 C 181.460 274.213,179.480 273.947,178.600 273.850 C 175.693 273.531,165.566 271.372,162.800 270.482 C 149.328 266.148,139.537 262.005,131.200 257.110 C 126.708 254.472,117.755 248.489,116.196 247.082 C 115.758 246.687,114.590 245.735,113.600 244.966 C 107.196 239.993,94.405 226.896,90.974 221.800 C 90.382 220.920,89.410 219.643,88.815 218.962 C 87.641 217.619,84.410 212.769,81.511 208.000 C 75.979 198.899,69.495 183.515,67.011 173.599 C 66.652 172.169,66.083 169.920,65.746 168.600 C 64.644 164.292,63.697 158.653,63.427 154.782 C 63.357 153.781,63.167 152.362,63.006 151.628 C 62.845 150.894,62.678 148.918,62.636 147.237 C 62.593 145.556,62.422 143.960,62.256 143.690 C 61.927 143.158,12.795 142.938,12.267 143.467 M73.596 144.007 C 73.358 144.452,73.270 144.990,73.401 145.201 C 73.607 145.534,73.876 147.784,74.573 155.000 C 74.658 155.880,75.018 158.130,75.373 160.000 C 75.728 161.870,76.100 163.850,76.199 164.400 C 77.169 169.753,79.278 176.716,82.013 183.600 C 82.931 185.910,83.931 188.430,84.234 189.200 C 85.825 193.243,91.918 204.114,95.221 208.800 C 96.538 210.670,97.923 212.650,98.299 213.200 C 98.674 213.750,99.210 214.344,99.490 214.520 C 99.771 214.696,100.000 215.033,100.000 215.270 C 100.000 215.912,105.718 222.336,106.320 222.370 C 106.607 222.387,107.101 221.815,107.418 221.100 C 107.735 220.385,108.621 218.810,109.385 217.600 C 110.149 216.390,111.126 214.770,111.554 214.000 C 113.243 210.967,118.882 203.621,121.300 201.302 C 122.345 200.301,123.200 199.268,123.200 199.008 C 123.200 198.587,125.683 196.162,131.200 191.196 C 140.373 182.937,153.494 175.279,165.136 171.387 C 172.645 168.877,174.378 168.408,179.600 167.468 C 181.030 167.211,182.380 166.882,182.601 166.738 C 182.821 166.594,184.692 166.343,186.758 166.182 C 188.824 166.020,191.344 165.676,192.357 165.418 L 194.200 164.948 194.200 154.174 L 194.200 143.400 134.115 143.299 C 74.151 143.198,74.029 143.199,73.596 144.007 M205.924 143.500 C 205.856 143.665,205.851 148.579,205.912 154.420 L 206.025 165.041 207.818 165.520 C 208.805 165.784,210.479 166.000,211.539 166.000 C 212.599 166.000,213.602 166.135,213.767 166.300 C 213.933 166.465,214.818 166.625,215.734 166.656 C 218.070 166.734,227.454 168.768,229.400 169.617 C 229.840 169.809,231.010 170.172,232.000 170.422 C 232.990 170.673,233.980 171.016,234.200 171.184 C 234.420 171.352,235.140 171.618,235.800 171.776 C 237.031 172.069,238.027 172.475,242.200 174.382 C 251.743 178.745,259.405 183.416,265.600 188.647 C 268.527 191.119,279.600 201.886,279.600 202.260 C 279.600 202.503,281.737 205.074,283.217 206.614 C 283.648 207.062,284.000 207.572,284.000 207.747 C 284.000 207.922,284.607 208.816,285.349 209.733 C 287.146 211.954,290.699 217.689,291.896 220.300 C 292.425 221.455,293.035 222.400,293.251 222.400 C 293.788 222.400,296.400 220.284,296.400 219.848 C 296.400 219.655,297.033 218.755,297.807 217.848 C 303.970 210.625,307.697 204.803,313.095 193.967 C 314.803 190.539,316.497 187.029,316.861 186.167 C 319.925 178.897,321.345 174.465,323.003 167.000 C 323.296 165.680,323.659 164.150,323.809 163.600 C 325.057 159.026,326.536 144.295,325.820 143.580 C 325.365 143.125,206.111 143.046,205.924 143.500 M191.488 176.646 C 191.339 176.794,189.908 177.073,188.309 177.265 C 183.277 177.869,181.433 178.218,176.012 179.591 C 168.136 181.586,153.454 188.217,147.963 192.259 C 146.662 193.216,145.491 194.000,145.361 194.000 C 144.720 194.000,137.853 199.975,133.722 204.128 C 129.507 208.365,128.000 209.991,128.000 210.303 C 128.000 210.500,127.552 211.081,127.004 211.596 C 126.457 212.110,124.972 214.077,123.704 215.966 C 122.437 217.855,121.282 219.490,121.137 219.601 C 120.992 219.711,120.119 221.151,119.197 222.801 C 118.275 224.450,117.003 226.700,116.370 227.800 C 114.652 230.784,114.766 231.152,118.426 234.473 C 120.200 236.083,121.984 237.524,122.391 237.674 C 122.799 237.825,123.282 238.185,123.466 238.474 C 123.961 239.254,130.613 243.796,136.003 247.036 C 138.198 248.355,146.794 252.695,151.000 254.608 C 155.077 256.461,167.796 260.545,171.000 261.029 C 171.440 261.095,173.150 261.449,174.800 261.816 C 176.450 262.182,178.340 262.549,179.000 262.630 C 179.660 262.712,181.280 262.962,182.600 263.187 C 184.867 263.574,188.346 263.900,192.400 264.108 L 194.200 264.200 194.302 220.500 C 194.402 177.618,194.389 176.800,193.634 176.800 C 193.212 176.800,192.616 176.704,192.312 176.588 C 192.007 176.471,191.636 176.497,191.488 176.646 M206.900 176.684 L 206.000 176.856 206.000 220.679 L 206.000 264.502 208.100 264.206 C 209.255 264.043,211.280 263.845,212.600 263.767 C 215.663 263.584,218.433 263.219,219.200 262.898 C 219.530 262.760,220.340 262.606,221.000 262.555 C 224.722 262.270,238.320 258.823,242.200 257.181 C 242.640 256.994,244.260 256.369,245.800 255.790 C 249.042 254.571,249.571 254.336,255.200 251.611 C 260.259 249.161,263.585 247.378,266.000 245.820 C 272.076 241.901,274.437 240.254,277.200 238.005 C 277.750 237.558,279.100 236.465,280.200 235.578 C 282.755 233.516,284.800 231.531,284.800 231.111 C 284.800 230.777,281.600 224.451,280.698 223.000 C 277.908 218.516,274.255 213.200,273.964 213.200 C 273.764 213.200,273.600 212.997,273.600 212.749 C 273.600 211.747,262.756 200.564,258.308 196.978 C 248.309 188.917,230.775 180.402,221.200 178.956 C 220.650 178.873,218.850 178.531,217.200 178.195 C 215.550 177.859,213.030 177.427,211.600 177.235 C 210.170 177.042,208.730 176.801,208.400 176.699 C 208.070 176.596,207.395 176.590,206.900 176.684 "
          stroke="none"
          fill={fillColor ?? "white"}
          fillRule="evenodd"
        />
      </g>
    </svg>
  );
}