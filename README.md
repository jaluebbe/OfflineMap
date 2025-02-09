# OfflineMap

### Setup of Python environment
```
cd offline_map
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```
Check your Python version by calling:
```
python --version
```
If your version is below 3.10 call:
```
pip install eval_type_backport
```

### Prepare OpenStreetMap offline data
```
docker run -e JAVA_TOOL_OPTIONS="-Xmx10g" -v "$(pwd)/data":/data ghcr.io/onthegomap/planetiler:latest --download --area=europe
```
You need Docker. Do not try this on a Raspberry Pi. It may take more than a day to create
the output.mbtiles even on a powerful machine. You may choose another or a
smaller region (e.g. "germany" or "dach" to include Austria, Germany and Switzerland).
For more information see the
[planetiler documentation](https://github.com/onthegomap/planetiler).
Finally, copy the output.mbtiles to the following location on your Raspberry Pi:
```
/home/gpstracker/OfflineMap/
```

This process may fail on Apple's M4 CPU running Sequoia 15.3 .
A [workaround](https://github.com/corretto/corretto-21/issues/85) with the additional parameter "-XX:UseSVE=0" may help.

These are some calls that were running successful on a Mac Mini M4 with 16GB of RAM.
For the first test I started with the state of Lower Saxony:
```
docker run -e JAVA_TOOL_OPTIONS="-Xmx1g -XX:UseSVE=0" -v "$(pwd)/data":/data ghcr.io/onthegomap/planetiler:latest --download --area=niedersachsen
```
It took 0:02:38 and resulted in a file size of 368 MB. 

Next I processed the data for Germany:
```
docker run -e JAVA_TOOL_OPTIONS="-Xmx2g -XX:UseSVE=0" -v "$(pwd)/data":/data ghcr.io/onthegomap/planetiler:latest --download --area=germany
```
It took 0:30:42 and resulted in a file size of 2.9 GB.

Finally I was able to create a dataset for the DACH region (Germany, Austria, Switzerland):
```
docker run -e JAVA_TOOL_OPTIONS="-Xmx2g -XX:UseSVE=0" -v "$(pwd)/data":/data ghcr.io/onthegomap/planetiler:latest --download --area=dach
```
It took 0:43:08 and resulted in a file size of 3.8 GB.

For larger OSM regions like Europe, the internal SSD (245.11 GB) is to small to handle amount of data.
